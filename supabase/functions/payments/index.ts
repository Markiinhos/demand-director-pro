import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";
const PIX_DEFAULT_EXPIRATION_MS = 60 * 60 * 1000;
const BOLETO_DEFAULT_EXPIRATION_DAYS = 3;

type MPEnvironment = "test" | "production";
type SupabaseClient = ReturnType<typeof createClient>;
type ChargeOperation = "pix" | "boleto" | "card";

class HttpError extends Error {
  status: number;
  payload?: Record<string, unknown>;

  constructor(status: number, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro interno ao processar a cobrança";
}

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapMPStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "awaiting_payment",
    approved: "approved",
    authorized: "authorized",
    in_process: "in_process",
    in_mediation: "in_mediation",
    rejected: "rejected",
    cancelled: "canceled",
    refunded: "refunded",
    charged_back: "charged_back",
    expired: "expired",
  };
  return map[status] || "pending";
}

function generateExternalRef(): string {
  return `DSO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new HttpError(401, "Unauthorized");

  return { supabase, userId: data.claims.sub as string };
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function detectMPEnvironmentFromCredential(value?: string): MPEnvironment | "unknown" {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (!normalized) return "unknown";
  if (normalized.startsWith("TEST-")) return "test";
  if (normalized.startsWith("APP_USR-")) return "production";

  return "unknown";
}

function maskCredential(value?: string): string {
  if (!value) return "missing";
  if (value.length <= 12) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function getMPConfigStatus() {
  const accessToken = safeTrim(Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN"));
  const environment = detectMPEnvironmentFromCredential(accessToken);
  const issues: string[] = [];

  if (!accessToken) {
    issues.push("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  } else if (environment === "unknown") {
    issues.push("Não foi possível identificar se o access token do Mercado Pago é test ou production.");
  }

  return {
    environment,
    isReady: issues.length === 0,
    issues,
    accessTokenConfigured: Boolean(accessToken),
    clientSecretConfigured: Boolean(safeTrim(Deno.env.get("MERCADO_PAGO_CLIENT_SECRET"))),
  };
}

function getMPConfig() {
  const accessToken = safeTrim(Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN"));
  const explicitEnvironment = safeTrim(Deno.env.get("MERCADO_PAGO_ENVIRONMENT"))?.toLowerCase();
  const status = getMPConfigStatus();

  if (!accessToken) throw new HttpError(500, "MERCADO_PAGO_ACCESS_TOKEN não configurado.");

  if (status.environment === "unknown") {
    throw new HttpError(500, "Não foi possível identificar se o access token do Mercado Pago é test ou production.");
  }

  if (explicitEnvironment && explicitEnvironment !== "test" && explicitEnvironment !== "production") {
    throw new HttpError(500, "MERCADO_PAGO_ENVIRONMENT deve ser 'test' ou 'production'.");
  }

  if (explicitEnvironment && explicitEnvironment !== status.environment) {
    throw new HttpError(
      500,
      `MERCADO_PAGO_ENVIRONMENT=${explicitEnvironment} não corresponde às chaves configuradas (${status.environment}).`,
    );
  }

  return {
    accessToken,
    environment: status.environment,
    clientSecretConfigured: status.clientSecretConfigured,
  };
}

function getWebhookUrl(): string {
  const supabaseUrl = safeTrim(Deno.env.get("SUPABASE_URL"));
  if (!supabaseUrl) throw new HttpError(500, "SUPABASE_URL não configurado.");
  return `${supabaseUrl}/functions/v1/payments/webhook`;
}

function logMPContext(context: string, config: ReturnType<typeof getMPConfig>) {
  console.log(
    "[payments] mp-config",
    JSON.stringify({
      context,
      environment: config.environment,
      accessToken: maskCredential(config.accessToken),
      clientSecretConfigured: config.clientSecretConfigured,
    }),
  );
}

function isValidEmail(value?: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function maskEmail(value?: string): string {
  if (!value) return "missing";
  const [local = "", domain = ""] = value.split("@");
  if (!domain) return `${local.slice(0, 2)}***`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskCpf(value?: string): string {
  if (!value) return "missing";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function maskPersonName(value?: string): string {
  if (!value) return "missing";
  const normalized = value.trim();
  if (!normalized) return "missing";
  return `${normalized.slice(0, 1)}***`;
}

function sanitizeMercadoPagoPayload(payload: unknown) {
  if (!isObject(payload)) return payload;

  const payer = isObject(payload.payer) ? payload.payer : null;
  const identification = payer && isObject(payer.identification) ? payer.identification : null;

  return {
    transaction_amount: payload.transaction_amount ?? null,
    description_present: Boolean(safeTrim(payload.description)),
    payment_method_id: payload.payment_method_id ?? null,
    external_reference: payload.external_reference ?? null,
    notification_url: payload.notification_url ?? null,
    date_of_expiration: payload.date_of_expiration ?? null,
    installments: payload.installments ?? null,
    payer: payer
      ? {
          email: typeof payer.email === "string" ? maskEmail(payer.email) : "missing",
          first_name: typeof payer.first_name === "string" ? maskPersonName(payer.first_name) : "missing",
          last_name: typeof payer.last_name === "string" ? maskPersonName(payer.last_name) : "missing",
          identification: identification
            ? {
                type: identification.type ?? null,
                number: typeof identification.number === "string" ? maskCpf(identification.number) : "missing",
              }
            : null,
        }
      : null,
  };
}

function sanitizeMercadoPagoResponse(payload: unknown) {
  if (!isObject(payload)) return payload;

  const transactionDetails = isObject(payload.transaction_details) ? payload.transaction_details : null;
  const pointOfInteraction = isObject(payload.point_of_interaction) ? payload.point_of_interaction : null;
  const transactionData = pointOfInteraction && isObject(pointOfInteraction.transaction_data)
    ? pointOfInteraction.transaction_data
    : null;

  return {
    id: payload.id ?? null,
    status: payload.status ?? null,
    status_detail: payload.status_detail ?? null,
    payment_method_id: payload.payment_method_id ?? null,
    external_reference: payload.external_reference ?? null,
    date_of_expiration: payload.date_of_expiration ?? null,
    transaction_amount: payload.transaction_amount ?? null,
    has_boleto_url: Boolean(transactionDetails?.external_resource_url),
    has_pix_qr_code: Boolean(transactionData?.qr_code),
    has_pix_qr_image: Boolean(transactionData?.qr_code_base64),
  };
}

function getMercadoPagoPrimaryCause(payload: Record<string, unknown> | null) {
  if (!Array.isArray(payload?.cause) || !isObject(payload.cause[0])) return null;
  return payload.cause[0];
}

function buildMercadoPagoErrorPayload(
  payload: Record<string, unknown> | null,
  rawText: string,
  httpStatus: number,
) {
  const primaryCause = getMercadoPagoPrimaryCause(payload);
  const message = typeof payload?.message === "string"
    ? payload.message
    : typeof primaryCause?.description === "string"
      ? primaryCause.description
      : rawText || "Erro ao comunicar com o Mercado Pago.";

  return {
    error: typeof payload?.status_detail === "string"
      ? payload.status_detail
      : typeof payload?.error === "string"
        ? payload.error
        : message,
    message,
    detail: typeof primaryCause?.description === "string"
      ? primaryCause.description
      : typeof payload?.status_detail === "string"
        ? payload.status_detail
        : null,
    status: payload?.status ?? null,
    status_detail: typeof payload?.status_detail === "string" ? payload.status_detail : null,
    code: typeof payload?.error === "string" || typeof payload?.error === "number"
      ? payload.error
      : typeof primaryCause?.code === "string" || typeof primaryCause?.code === "number"
        ? primaryCause.code
        : null,
    cause: payload?.cause ?? null,
    http_status: httpStatus,
    api_response: payload ?? rawText,
  };
}

function logValidationResult(
  operation: ChargeOperation,
  environment: MPEnvironment,
  status: "passed" | "failed",
  payer: { email?: string; firstName?: string; lastName?: string; cpf?: string },
  error?: string,
) {
  console.log(
    `[payments] validation-${status}`,
    JSON.stringify({
      operation,
      environment,
      payer: {
        email: maskEmail(payer.email),
        first_name: maskPersonName(payer.firstName),
        last_name: maskPersonName(payer.lastName),
        cpf: maskCpf(payer.cpf),
      },
      error: error ?? null,
    }),
  );
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new HttpError(400, "Data de expiração inválida. Use AAAA-MM-DD ou ISO 8601.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "Data de expiração inválida. Verifique o dia informado.");
  }

  return { year, month, day };
}

function dateOnlyToIso(value: string, endOfDay = false): string {
  const { year, month, day } = parseDateOnly(value);
  return new Date(
    Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0),
  ).toISOString();
}

function normalizeDueDate(value: unknown): string | null {
  const raw = safeTrim(value);
  if (!raw) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    throw new HttpError(400, "Data de expiração inválida. Use AAAA-MM-DD ou ISO 8601.");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parseDateOnly(raw);
    return raw;
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "Data de expiração inválida. Use AAAA-MM-DD ou ISO 8601.");
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function assertFutureExpiration(isoDate: string, message: string) {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    throw new HttpError(400, "Data de expiração inválida. Não foi possível converter para ISO 8601.");
  }

  if (timestamp <= Date.now()) {
    throw new HttpError(400, message);
  }
}

function getDefaultDateOnly(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildPixExpirationDate(rawDueDate: unknown): { dueDate: string | null; expirationDate: string } {
  const dueDate = normalizeDueDate(rawDueDate);
  const expirationDate = dueDate
    ? dateOnlyToIso(dueDate, true)
    : new Date(Date.now() + PIX_DEFAULT_EXPIRATION_MS).toISOString();

  assertFutureExpiration(expirationDate, "A data de expiração do Pix precisa estar no futuro.");

  console.log(
    "[payments] pix-expiration",
    JSON.stringify({
      raw_due_date: rawDueDate ?? null,
      normalized_due_date: dueDate,
      date_of_expiration: expirationDate,
    }),
  );

  return { dueDate, expirationDate };
}

function buildBoletoDates(rawDueDate: unknown): { dueDate: string; expirationDate: string } {
  const dueDate = normalizeDueDate(rawDueDate) ?? getDefaultDateOnly(BOLETO_DEFAULT_EXPIRATION_DAYS);
  const expirationDate = dateOnlyToIso(dueDate, true);

  assertFutureExpiration(expirationDate, "A data de vencimento do boleto precisa estar no futuro.");

  console.log(
    "[payments] boleto-expiration",
    JSON.stringify({
      raw_due_date: rawDueDate ?? null,
      normalized_due_date: dueDate,
      date_of_expiration: expirationDate,
    }),
  );

  return { dueDate, expirationDate };
}

function sanitizeCpf(value: unknown): string | undefined {
  const raw = safeTrim(value);
  if (!raw) return undefined;

  const digits = raw.replace(/\D/g, "");
  return digits || undefined;
}

function isValidCpf(value?: string): boolean {
  if (!value || value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(value[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(value[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(value[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(value[10]);
}

// Removed isPlaceholderEmail and isTestUserEmail — they were incorrectly blocking real payer data

function splitFullName(fullName?: string) {
  const normalized = safeTrim(fullName);
  if (!normalized) return { firstName: undefined, lastName: undefined };

  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

async function resolvePayer(supabase: SupabaseClient, clientId: string, payload: Record<string, unknown>) {
  const hasEmail = Boolean(safeTrim(payload.payer_email));
  const hasFirstName = Boolean(safeTrim(payload.payer_first_name));
  const hasLastName = Boolean(safeTrim(payload.payer_last_name));

  let client: { name?: string | null; email?: string | null; contact_name?: string | null } | null = null;

  if (!hasEmail || !hasFirstName || !hasLastName) {
    const { data, error } = await supabase
      .from("clients")
      .select("name, email, contact_name")
      .eq("id", clientId)
      .single();

    if (error) {
      throw new HttpError(400, "Cliente não encontrado para preencher os dados do pagador.");
    }

    client = data;
  }

  const fallbackName = safeTrim(client?.contact_name) ?? safeTrim(client?.name);
  const fallbackSplit = splitFullName(fallbackName);

  return {
    email: safeTrim(payload.payer_email) ?? safeTrim(client?.email),
    firstName: safeTrim(payload.payer_first_name) ?? fallbackSplit.firstName,
    lastName: safeTrim(payload.payer_last_name) ?? fallbackSplit.lastName ?? "",
    cpf: sanitizeCpf(payload.payer_cpf),
  };
}

function validatePayer(
  payer: { email?: string; firstName?: string; lastName?: string; cpf?: string },
  _environment: MPEnvironment,
  operation: ChargeOperation,
) {
  if (!payer.email) {
    throw new HttpError(400, "Informe o e-mail do pagador.");
  }

  if (!isValidEmail(payer.email)) {
    throw new HttpError(400, "E-mail do pagador inválido.");
  }

  if (!payer.firstName) {
    throw new HttpError(400, "Informe o nome do pagador.");
  }

  if (!payer.lastName) {
    throw new HttpError(400, "Informe o sobrenome do pagador.");
  }

  if (!payer.cpf) {
    throw new HttpError(
      400,
      operation === "card"
        ? "Informe o CPF do titular do cartão."
        : "Informe o CPF do pagador.",
    );
  }

  if (!isValidCpf(payer.cpf)) {
    throw new HttpError(400, "CPF do pagador inválido.");
  }
}

function validateCommonChargeFields(payload: Record<string, unknown>) {
  const clientId = safeTrim(payload.client_id);
  const description = safeTrim(payload.description);
  const amount = Number(payload.amount);

  if (!clientId || !description || !Number.isFinite(amount) || amount < 1) {
    throw new HttpError(400, "client_id, amount e description são obrigatórios, e amount deve ser de pelo menos R$ 1,00.");
  }

  return { clientId, description, amount };
}

function getFriendlyMercadoPagoError(message: string): string {
  return message;
}

async function mpFetch(
  path: string,
  config: ReturnType<typeof getMPConfig>,
  options: RequestInit = {},
  context?: Record<string, unknown>,
) {
  const method = (options.method || "GET").toUpperCase();
  const requestPayload = typeof options.body === "string"
    ? (() => {
        try {
          return JSON.parse(options.body);
        } catch {
          return options.body;
        }
      })()
    : options.body;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    ...(method === "GET" ? {} : { "X-Idempotency-Key": crypto.randomUUID() }),
    ...(options.headers || {}),
  };

  console.log(
    "[payments] mercado-pago-request",
    JSON.stringify({
      path,
      method,
      environment: config.environment,
      context,
      payload: sanitizeMercadoPagoPayload(requestPayload),
    }),
  );

  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers,
  });

  const rawText = await res.text();
  let data: Record<string, unknown> | null = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText ? { raw: rawText } : null;
  }

  if (!res.ok) {
    const errorPayload = buildMercadoPagoErrorPayload(data, rawText, res.status);

    console.error(
      "[MP FULL ERROR]",
      JSON.stringify({
        path,
        method,
        status: res.status,
        environment: config.environment,
        context,
        request_payload: sanitizeMercadoPagoPayload(requestPayload),
        response: data,
        summarized_response: sanitizeMercadoPagoResponse(data),
        extracted: {
          status: errorPayload.status,
          status_detail: errorPayload.status_detail,
          message: errorPayload.message,
          error: errorPayload.code,
          cause: errorPayload.cause,
        },
      }),
    );

    throw new HttpError(
      res.status >= 500 ? 502 : 400,
      getFriendlyMercadoPagoError(errorPayload.message),
      errorPayload,
    );
  }

  console.log(
    "[payments] mercado-pago-response",
    JSON.stringify({
      path,
      method,
      environment: config.environment,
      context,
      response: sanitizeMercadoPagoResponse(data),
    }),
  );

  return data;
}

async function getConfigStatus(req: Request): Promise<Response> {
  await getAuthenticatedUser(req);
  return jsonResponse(getMPConfigStatus());
}

async function parseRequestBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "JSON inválido na requisição.");
  }

  if (!isObject(body)) throw new HttpError(400, "Corpo da requisição inválido.");
  return body;
}

async function createPix(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseRequestBody(req);
  const { clientId, description, amount } = validateCommonChargeFields(body);
  const config = getMPConfig();
  logMPContext("create-pix", config);

  const { dueDate, expirationDate } = buildPixExpirationDate(body.due_date);
  const payer = await resolvePayer(supabase, clientId, body);
  try {
    validatePayer(payer, config.environment, "pix");
    logValidationResult("pix", config.environment, "passed", payer);
  } catch (error) {
    logValidationResult("pix", config.environment, "failed", payer, getErrorMessage(error));
    throw error;
  }

  const externalRef = generateExternalRef();
  const mpData = await mpFetch(
    "/v1/payments",
    config,
    {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        external_reference: externalRef,
        notification_url: getWebhookUrl(),
        date_of_expiration: expirationDate,
        payer: {
          email: payer.email,
          first_name: payer.firstName,
          last_name: payer.lastName || undefined,
          identification: payer.cpf ? { type: "CPF", number: payer.cpf } : undefined,
        },
      }),
    },
    { operation: "create-pix", external_reference: externalRef },
  );

  const charge = {
    user_id: userId,
    client_id: clientId,
    budget_id: safeTrim(body.budget_id) || null,
    demand_id: safeTrim(body.demand_id) || null,
    financial_entry_id: safeTrim(body.financial_entry_id) || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData?.id),
    payment_method: "pix",
    status: mapMPStatus(String(mpData?.status || "pending")),
    amount,
    description,
    due_date: dueDate,
    pix_qr_code: typeof mpData?.point_of_interaction?.transaction_data?.qr_code_base64 === "string"
      ? mpData.point_of_interaction.transaction_data.qr_code_base64
      : null,
    pix_copy_paste: typeof mpData?.point_of_interaction?.transaction_data?.qr_code === "string"
      ? mpData.point_of_interaction.transaction_data.qr_code
      : null,
    external_reference: externalRef,
    metadata: {
      mp_response_id: mpData?.id,
      mp_environment: config.environment,
      date_of_expiration: expirationDate,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  return jsonResponse(data);
}

async function createBoleto(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseRequestBody(req);
  const { clientId, description, amount } = validateCommonChargeFields(body);
  const config = getMPConfig();
  logMPContext("create-boleto", config);

  const { dueDate, expirationDate } = buildBoletoDates(body.due_date);
  const payer = await resolvePayer(supabase, clientId, body);
  try {
    validatePayer(payer, config.environment, "boleto");
    logValidationResult("boleto", config.environment, "passed", payer);
  } catch (error) {
    logValidationResult("boleto", config.environment, "failed", payer, getErrorMessage(error));
    throw error;
  }

  const externalRef = generateExternalRef();
  const mpData = await mpFetch(
    "/v1/payments",
    config,
    {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: "bolbradesco",
        external_reference: externalRef,
        notification_url: getWebhookUrl(),
        date_of_expiration: expirationDate,
        payer: {
          email: payer.email,
          first_name: payer.firstName,
          last_name: payer.lastName || undefined,
          identification: payer.cpf ? { type: "CPF", number: payer.cpf } : undefined,
        },
      }),
    },
    { operation: "create-boleto", external_reference: externalRef },
  );

  const externalResourceUrl = typeof mpData?.transaction_details?.external_resource_url === "string"
    ? mpData.transaction_details.external_resource_url
    : null;

  const charge = {
    user_id: userId,
    client_id: clientId,
    budget_id: safeTrim(body.budget_id) || null,
    demand_id: safeTrim(body.demand_id) || null,
    financial_entry_id: safeTrim(body.financial_entry_id) || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData?.id),
    payment_method: "boleto",
    status: mapMPStatus(String(mpData?.status || "pending")),
    amount,
    description,
    due_date: dueDate,
    bank_slip_url: externalResourceUrl,
    invoice_url: externalResourceUrl,
    external_reference: externalRef,
    metadata: {
      mp_response_id: mpData?.id,
      mp_environment: config.environment,
      date_of_expiration: expirationDate,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  return jsonResponse(data);
}

async function createCard(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseRequestBody(req);
  const { clientId, description, amount } = validateCommonChargeFields(body);
  const token = safeTrim(body.token);

  if (!token) {
    throw new HttpError(400, "client_id, amount, description e token são obrigatórios.");
  }

  const config = getMPConfig();
  logMPContext("create-card", config);

  const payer = await resolvePayer(supabase, clientId, body);
  try {
    validatePayer(payer, config.environment, "card");
    logValidationResult("card", config.environment, "passed", payer);
  } catch (error) {
    logValidationResult("card", config.environment, "failed", payer, getErrorMessage(error));
    throw error;
  }

  const externalRef = generateExternalRef();
  const mpData = await mpFetch(
    "/v1/payments",
    config,
    {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        token,
        installments: Number(body.installments) || 1,
        payment_method_id: safeTrim(body.payment_method_id) || undefined,
        external_reference: externalRef,
        notification_url: getWebhookUrl(),
        payer: {
          email: payer.email,
          first_name: payer.firstName,
          last_name: payer.lastName || undefined,
          identification: payer.cpf ? { type: "CPF", number: payer.cpf } : undefined,
        },
      }),
    },
    { operation: "create-card", external_reference: externalRef },
  );

  const charge = {
    user_id: userId,
    client_id: clientId,
    budget_id: safeTrim(body.budget_id) || null,
    demand_id: safeTrim(body.demand_id) || null,
    financial_entry_id: safeTrim(body.financial_entry_id) || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData?.id),
    payment_method: "card",
    status: mapMPStatus(String(mpData?.status || "pending")),
    amount,
    description,
    card_last4: typeof mpData?.card?.last_four_digits === "string" ? mpData.card.last_four_digits : null,
    paid_at: mpData?.status === "approved" ? new Date().toISOString() : null,
    external_reference: externalRef,
    metadata: {
      mp_response_id: mpData?.id,
      mp_environment: config.environment,
      card_brand: mpData?.payment_method_id,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  const financialEntryId = safeTrim(body.financial_entry_id);
  if (mpData?.status === "approved" && financialEntryId) {
    await supabase
      .from("financial_entries")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", financialEntryId);
  }

  return jsonResponse(data);
}

async function listCharges(req: Request): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");

  let query = supabase.from("payment_charges").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (method) query = query.eq("payment_method", method);

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse(data);
}

async function getCharge(req: Request, id: string): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const { data, error } = await supabase.from("payment_charges").select("*").eq("id", id).single();
  if (error) throw error;
  return jsonResponse(data);
}

async function cancelCharge(req: Request, id: string): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const config = getMPConfig();
  const { data: charge, error: fetchErr } = await supabase.from("payment_charges").select("*").eq("id", id).single();
  if (fetchErr) throw fetchErr;

  if (charge.provider_charge_id) {
    try {
      await mpFetch(
        `/v1/payments/${charge.provider_charge_id}`,
        config,
        {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled" }),
        },
        { operation: "cancel-charge", charge_id: id },
      );
    } catch (error) {
      console.warn("[payments] cancel-warning", getErrorMessage(error));
    }
  }

  const { data, error } = await supabase
    .from("payment_charges")
    .update({ status: "canceled" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}

async function handleWebhook(req: Request): Promise<Response> {
  const serviceClient = getServiceClient();
  const config = getMPConfig();
  let eventId: string | null = null;
  let payload: Record<string, unknown>;

  try {
    payload = await parseRequestBody(req);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const { data: event, error: eventError } = await serviceClient
    .from("payment_events")
    .insert({
      provider: "mercadopago",
      event_type: String(payload.type || payload.action || "unknown"),
      payload,
    })
    .select("id")
    .single();

  if (!eventError) eventId = event?.id ?? null;

  if (payload.type === "payment" && isObject(payload.data) && payload.data.id) {
    const paymentId = String(payload.data.id);

    try {
      const mpPayment = await mpFetch(
        `/v1/payments/${paymentId}`,
        config,
        {},
        { operation: "webhook-fetch", payment_id: paymentId },
      );
      const newStatus = mapMPStatus(String(mpPayment?.status || "pending"));

      const { data: charges, error: chargesError } = await serviceClient
        .from("payment_charges")
        .select("*")
        .eq("provider_charge_id", paymentId)
        .limit(1);

      if (chargesError) throw chargesError;

      if (charges && charges.length > 0) {
        const charge = charges[0];
        const updateData: Record<string, unknown> = { status: newStatus };

        if (mpPayment?.status === "approved") {
          updateData.paid_at = new Date().toISOString();

          if (charge.financial_entry_id) {
            await serviceClient
              .from("financial_entries")
              .update({ status: "pago", paid_at: new Date().toISOString() })
              .eq("id", charge.financial_entry_id);
          }
        }

        await serviceClient.from("payment_charges").update(updateData).eq("id", charge.id);

        if (eventId) {
          await serviceClient
            .from("payment_events")
            .update({ processed: true, user_id: charge.user_id, charge_id: charge.id, error_message: null })
            .eq("id", eventId);
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("[payments] webhook-error", JSON.stringify({ payment_id: paymentId, error: errorMessage }));

      if (eventId) {
        await serviceClient
          .from("payment_events")
          .update({ error_message: errorMessage })
          .eq("id", eventId);
      } else {
        await serviceClient.from("payment_events").insert({
          provider: "mercadopago",
          event_type: "webhook_error",
          payload,
          error_message: errorMessage,
        });
      }
    }
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/payments\/?/, "").replace(/\/$/, "");

    if (path === "webhook" && req.method === "POST") {
      return await handleWebhook(req);
    }

    if (path === "config-status" && req.method === "GET") return await getConfigStatus(req);
    if (path === "create-pix" && req.method === "POST") return await createPix(req);
    if (path === "create-boleto" && req.method === "POST") return await createBoleto(req);
    if (path === "create-card" && req.method === "POST") return await createCard(req);
    if (path === "" && req.method === "GET") return await listCharges(req);

    const idMatch = path.match(/^([a-f0-9-]+)$/);
    if (idMatch && req.method === "GET") return await getCharge(req, idMatch[1]);

    const cancelMatch = path.match(/^([a-f0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") return await cancelCharge(req, cancelMatch[1]);

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : getErrorMessage(error) === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: getErrorMessage(error) }, status);
  }
});
