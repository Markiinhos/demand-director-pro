import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";
const PIX_DEFAULT_EXPIRATION_MS = 60 * 60 * 1000;
const BOLETO_DEFAULT_EXPIRATION_DAYS = 3;
const PREFERENCE_DEFAULT_EXPIRATION_DAYS = 7;

type MPEnvironment = "test" | "production";
type SupabaseClient = ReturnType<typeof createClient>;
type ChargeOperation = "pix" | "boleto" | "link";
type DocumentType = "CPF" | "CNPJ";

interface MPUserConfig {
  accessToken: string;
  environment: MPEnvironment;
  mpUserId: string;
  liveMode: boolean;
}

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

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erro interno";
}

function safeTrim(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function onlyDigits(v: unknown): string | undefined {
  const t = safeTrim(v);
  if (!t) return undefined;
  const d = t.replace(/\D/g, "");
  return d || undefined;
}

function isValidCpf(v?: string): boolean {
  if (!v || v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(v[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== Number(v[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(v[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(v[10]);
}

function isValidCnpj(v?: string): boolean {
  if (!v || v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false;
  const calc = (len: number) => {
    const w = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(v[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(v[12]) && calc(13) === Number(v[13]);
}

function isValidEmail(v?: string): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function maskEmail(v?: string): string {
  if (!v) return "missing";
  const [l = "", d = ""] = v.split("@");
  if (!d) return `${l.slice(0, 2)}***`;
  return `${l.slice(0, 2)}***@${d}`;
}

function maskDoc(v?: string): string {
  if (!v) return "missing";
  if (v.length === 11) return `***.***.***-${v.slice(-2)}`;
  if (v.length === 14) return `**.***.***/${v.slice(8, 12)}-**`;
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

function maskName(v?: string): string {
  if (!v) return "missing";
  const t = v.trim();
  return t ? `${t.slice(0, 1)}***` : "missing";
}

function maskCredential(v?: string): string {
  if (!v) return "missing";
  if (v.length <= 12) return `${v.slice(0, 4)}…`;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

function detectEnv(v?: string): MPEnvironment | "unknown" {
  const n = v?.trim().toUpperCase() ?? "";
  if (!n) return "unknown";
  if (n.startsWith("TEST-")) return "test";
  if (n.startsWith("APP_USR-")) return "production";
  return "unknown";
}

async function getUserMPConfig(userId: string): Promise<MPUserConfig> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("mp_connections")
    .select("access_token, mp_user_id, live_mode")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Erro ao buscar conexão Mercado Pago.");
  if (!data?.access_token) {
    throw new HttpError(412, "Conta Mercado Pago não conectada. Conecte em Configurações → Integrações.");
  }
  const env = detectEnv(data.access_token as string);
  return {
    accessToken: data.access_token as string,
    environment: env === "unknown" ? (data.live_mode ? "production" : "test") : env,
    mpUserId: String(data.mp_user_id ?? ""),
    liveMode: Boolean(data.live_mode),
  };
}

async function getConnectionStatus(userId: string) {
  const service = getServiceClient();
  const { data } = await service
    .from("mp_connections")
    .select("mp_user_id, live_mode, scope, connected_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  const webhookSecret = safeTrim(Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET"));
  const clientId = safeTrim(Deno.env.get("MP_CLIENT_ID"));
  const clientSecret = safeTrim(Deno.env.get("MP_CLIENT_SECRET"));
  const connected = Boolean(data?.mp_user_id);
  const issues: string[] = [];
  if (!clientId || !clientSecret) issues.push("App OAuth do Mercado Pago não configurado (MP_CLIENT_ID/MP_CLIENT_SECRET ausentes).");
  if (!webhookSecret) issues.push("Webhook do Mercado Pago não configurado.");
  if (!connected) issues.push("Conta Mercado Pago do usuário não conectada.");
  return {
    connected,
    mp_user_id: data?.mp_user_id ?? null,
    live_mode: Boolean(data?.live_mode),
    environment: data?.live_mode ? "production" : "test",
    scope: data?.scope ?? null,
    connected_at: data?.connected_at ?? null,
    expires_at: data?.expires_at ?? null,
    isReady: connected && !!webhookSecret && !!clientId && !!clientSecret,
    issues,
    webhookSecretConfigured: Boolean(webhookSecret),
    oauthAppConfigured: Boolean(clientId && clientSecret),
  };
}

function getWebhookUrl(): string {
  const url = safeTrim(Deno.env.get("SUPABASE_URL"));
  if (!url) throw new HttpError(500, "SUPABASE_URL não configurado.");
  return `${url}/functions/v1/payments/webhook`;
}

function getOAuthCallbackUrl(): string {
  const url = safeTrim(Deno.env.get("SUPABASE_URL"));
  if (!url) throw new HttpError(500, "SUPABASE_URL não configurado.");
  return `${url}/functions/v1/payments/oauth-callback`;
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

function mapMPStatus(s: string): string {
  const m: Record<string, string> = {
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
  return m[s] || "pending";
}

function generateExternalRef(): string {
  return `DSO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ---------------- Date helpers ----------------
function parseDateOnly(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new HttpError(400, "Data inválida (use AAAA-MM-DD).");
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new HttpError(400, "Data inválida.");
  }
  return { y, mo, d };
}

function dateOnlyToIso(v: string, eod = false): string {
  const { y, mo, d } = parseDateOnly(v);
  return new Date(Date.UTC(y, mo - 1, d, eod ? 23 : 0, eod ? 59 : 0, eod ? 59 : 0)).toISOString();
}

function normalizeDueDate(v: unknown): string | null {
  const r = safeTrim(v);
  if (!r) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(r)) {
    parseDateOnly(r);
    return r;
  }
  const p = Date.parse(r);
  if (Number.isNaN(p)) throw new HttpError(400, "Data de vencimento inválida.");
  return new Date(p).toISOString().slice(0, 10);
}

function getDefaultDateOnly(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------------- Payer ----------------
type ResolvedPayer = {
  type: "PF" | "PJ";
  email: string;
  firstName: string;
  lastName: string;
  document: string;
  documentType: DocumentType;
};

async function resolvePayer(
  supabase: SupabaseClient,
  clientId: string,
  body: Record<string, unknown>,
): Promise<ResolvedPayer> {
  const payerType = (safeTrim(body.payer_type) as "PF" | "PJ" | undefined) ?? "PF";

  let client: { name?: string | null; email?: string | null; contact_name?: string | null } | null = null;
  const needsClient =
    !safeTrim(body.payer_email) ||
    (payerType === "PF" && (!safeTrim(body.payer_first_name) || !safeTrim(body.payer_last_name))) ||
    (payerType === "PJ" && !safeTrim(body.payer_company_name));

  if (needsClient) {
    const { data, error } = await supabase
      .from("clients")
      .select("name, email, contact_name")
      .eq("id", clientId)
      .single();
    if (error) throw new HttpError(400, "Cliente não encontrado para preencher dados do pagador.");
    client = data;
  }

  const fallbackName = safeTrim(client?.contact_name) ?? safeTrim(client?.name);
  const fallbackParts = fallbackName ? fallbackName.split(/\s+/) : [];

  const email = safeTrim(body.payer_email) ?? safeTrim(client?.email) ?? "";
  const document = onlyDigits(body.payer_document) ?? "";

  let firstName = "";
  let lastName = "";
  let documentType: DocumentType;

  if (payerType === "PJ") {
    const company = safeTrim(body.payer_company_name) ?? safeTrim(client?.name) ?? "";
    firstName = company;
    lastName = ".";
    documentType = "CNPJ";
  } else {
    firstName = safeTrim(body.payer_first_name) ?? fallbackParts[0] ?? "";
    lastName =
      safeTrim(body.payer_last_name) ??
      (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ") : "");
    documentType = "CPF";
  }

  return { type: payerType, email, firstName, lastName, document, documentType };
}

function validatePayer(payer: ResolvedPayer, op: ChargeOperation) {
  if (!payer.email) throw new HttpError(400, "Informe o e-mail do pagador.");
  if (!isValidEmail(payer.email)) throw new HttpError(400, "E-mail do pagador inválido.");

  if (payer.type === "PJ") {
    if (!payer.firstName || payer.firstName.length < 2) {
      throw new HttpError(400, "Informe a razão social da empresa.");
    }
    if (!payer.document) throw new HttpError(400, "Informe o CNPJ.");
    if (!isValidCnpj(payer.document)) throw new HttpError(400, "CNPJ inválido.");
  } else {
    if (!payer.firstName || payer.firstName.length < 2) {
      throw new HttpError(400, "Informe o nome do pagador (mín. 2 caracteres).");
    }
    if (!payer.lastName || payer.lastName.length < 2) {
      throw new HttpError(400, "Informe o sobrenome do pagador (mín. 2 caracteres).");
    }
    if (!payer.document) throw new HttpError(400, "Informe o CPF do pagador.");
    if (!isValidCpf(payer.document)) throw new HttpError(400, "CPF inválido.");
  }

  console.log("[payments] payer-validated", JSON.stringify({
    op,
    type: payer.type,
    email: maskEmail(payer.email),
    name: maskName(payer.firstName),
    document: maskDoc(payer.document),
    documentType: payer.documentType,
  }));
}

// ---------------- MP HTTP ----------------
function buildMPErrorPayload(payload: Record<string, unknown> | null, raw: string, httpStatus: number) {
  const cause = Array.isArray(payload?.cause) && isObject(payload.cause[0]) ? payload.cause[0] : null;
  const message = typeof payload?.message === "string"
    ? payload.message
    : typeof cause?.description === "string"
      ? cause.description
      : raw || "Erro ao comunicar com o Mercado Pago.";
  return {
    error: typeof payload?.status_detail === "string" ? payload.status_detail
      : typeof payload?.error === "string" ? payload.error : message,
    message,
    detail: typeof cause?.description === "string" ? cause.description
      : typeof payload?.status_detail === "string" ? payload.status_detail : null,
    status: payload?.status ?? null,
    status_detail: typeof payload?.status_detail === "string" ? payload.status_detail : null,
    code: typeof payload?.error === "string" || typeof payload?.error === "number" ? payload.error
      : typeof cause?.code === "string" || typeof cause?.code === "number" ? cause.code : null,
    cause: payload?.cause ?? null,
    http_status: httpStatus,
  };
}

async function mpFetch(
  path: string,
  config: ReturnType<typeof getMPConfig>,
  options: RequestInit = {},
  context?: Record<string, unknown>,
) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    ...(method === "GET" ? {} : { "X-Idempotency-Key": crypto.randomUUID() }),
    ...(options.headers || {}),
  };

  console.log("[payments] mp-request", JSON.stringify({
    path,
    method,
    environment: config.environment,
    token: maskCredential(config.accessToken),
    context,
  }));

  const res = await fetch(`${MP_API}${path}`, { ...options, headers });
  const raw = await res.text();
  let data: Record<string, unknown> | null = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw ? { raw } : null; }

  if (!res.ok) {
    const err = buildMPErrorPayload(data, raw, res.status);
    console.error("[MP FULL ERROR]", JSON.stringify({
      path, method, status: res.status, environment: config.environment, context,
      response: data, extracted: err,
    }));
    throw new HttpError(res.status >= 500 ? 502 : 400, err.message, err);
  }

  console.log("[payments] mp-response", JSON.stringify({
    path, method, environment: config.environment, context,
    id: data?.id ?? null, status: data?.status ?? null,
  }));
  return data;
}

// ---------------- Common validation ----------------
function validateCommon(body: Record<string, unknown>) {
  const clientId = safeTrim(body.client_id);
  const description = safeTrim(body.description);
  const amount = Number(body.amount);
  if (!clientId || !description || !Number.isFinite(amount) || amount < 1) {
    throw new HttpError(400, "client_id, description e amount (≥ R$ 1,00) são obrigatórios.");
  }
  return { clientId, description, amount };
}

function buildIdentification(payer: ResolvedPayer) {
  return { type: payer.documentType, number: payer.document };
}

// ---------------- Routes ----------------
async function getConfigStatus(req: Request): Promise<Response> {
  const { userId } = await getAuthenticatedUser(req);
  return jsonResponse(await getConnectionStatus(userId));
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  let b: unknown;
  try { b = await req.json(); } catch { throw new HttpError(400, "JSON inválido."); }
  if (!isObject(b)) throw new HttpError(400, "Corpo inválido.");
  return b;
}

async function createPix(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseBody(req);
  const { clientId, description, amount } = validateCommon(body);
  const config = await getUserMPConfig(userId);

  const dueDate = normalizeDueDate(body.due_date);
  const expirationDate = dueDate
    ? dateOnlyToIso(dueDate, true)
    : new Date(Date.now() + PIX_DEFAULT_EXPIRATION_MS).toISOString();
  if (Date.parse(expirationDate) <= Date.now()) {
    throw new HttpError(400, "A data de expiração do Pix deve estar no futuro.");
  }

  const payer = await resolvePayer(supabase, clientId, body);
  validatePayer(payer, "pix");

  const externalRef = generateExternalRef();
  const mpData = await mpFetch("/v1/payments", config, {
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
        identification: buildIdentification(payer),
      },
    }),
  }, { operation: "create-pix", external_reference: externalRef });

  const txData = isObject(mpData?.point_of_interaction)
    && isObject((mpData!.point_of_interaction as Record<string, unknown>).transaction_data)
    ? (mpData!.point_of_interaction as Record<string, unknown>).transaction_data as Record<string, unknown>
    : null;

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
    pix_qr_code: typeof txData?.qr_code_base64 === "string" ? txData.qr_code_base64 : null,
    pix_copy_paste: typeof txData?.qr_code === "string" ? txData.qr_code : null,
    external_reference: externalRef,
    metadata: {
      mp_response_id: mpData?.id,
      mp_environment: config.environment,
      payer_type: payer.type,
      document_type: payer.documentType,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;
  return jsonResponse(data);
}

async function createBoleto(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseBody(req);
  const { clientId, description, amount } = validateCommon(body);
  const config = await getUserMPConfig(userId);

  const dueDate = normalizeDueDate(body.due_date) ?? getDefaultDateOnly(BOLETO_DEFAULT_EXPIRATION_DAYS);
  const expirationDate = dateOnlyToIso(dueDate, true);
  if (Date.parse(expirationDate) <= Date.now()) {
    throw new HttpError(400, "Vencimento do boleto deve estar no futuro.");
  }

  const payer = await resolvePayer(supabase, clientId, body);
  validatePayer(payer, "boleto");

  const externalRef = generateExternalRef();
  const mpData = await mpFetch("/v1/payments", config, {
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
        identification: buildIdentification(payer),
      },
    }),
  }, { operation: "create-boleto", external_reference: externalRef });

  const tx = isObject(mpData?.transaction_details)
    ? (mpData!.transaction_details as Record<string, unknown>)
    : null;
  const url = typeof tx?.external_resource_url === "string" ? tx.external_resource_url : null;

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
    bank_slip_url: url,
    invoice_url: url,
    external_reference: externalRef,
    metadata: {
      mp_response_id: mpData?.id,
      mp_environment: config.environment,
      payer_type: payer.type,
      document_type: payer.documentType,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;
  return jsonResponse(data);
}

// Checkout Pro link (cliente paga em ambiente do MP — cartão, pix, boleto)
async function createPaymentLink(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await parseBody(req);
  const { clientId, description, amount } = validateCommon(body);
  const config = await getUserMPConfig(userId);

  const expirationDays = Number(body.expiration_days) > 0
    ? Number(body.expiration_days)
    : PREFERENCE_DEFAULT_EXPIRATION_DAYS;
  const expirationDate = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

  const payer = await resolvePayer(supabase, clientId, body);
  validatePayer(payer, "link");

  const externalRef = generateExternalRef();
  const installments = Number(body.installments);
  const maxInstallments = Number.isFinite(installments) && installments > 0 && installments <= 12
    ? Math.floor(installments)
    : 12;

  const mpData = await mpFetch("/checkout/preferences", config, {
    method: "POST",
    body: JSON.stringify({
      items: [{
        title: description,
        quantity: 1,
        currency_id: "BRL",
        unit_price: amount,
      }],
      external_reference: externalRef,
      notification_url: getWebhookUrl(),
      expires: true,
      expiration_date_to: expirationDate,
      payment_methods: {
        installments: maxInstallments,
        excluded_payment_types: [],
      },
      payer: {
        email: payer.email,
        name: payer.firstName,
        surname: payer.lastName || undefined,
        identification: buildIdentification(payer),
      },
      metadata: {
        external_reference: externalRef,
        payer_type: payer.type,
      },
    }),
  }, { operation: "create-payment-link", external_reference: externalRef });

  const initPoint = typeof mpData?.init_point === "string"
    ? mpData.init_point
    : typeof mpData?.sandbox_init_point === "string"
      ? mpData.sandbox_init_point
      : null;

  if (!initPoint) {
    throw new HttpError(502, "Mercado Pago não retornou init_point para a preferência.");
  }

  const charge = {
    user_id: userId,
    client_id: clientId,
    budget_id: safeTrim(body.budget_id) || null,
    demand_id: safeTrim(body.demand_id) || null,
    financial_entry_id: safeTrim(body.financial_entry_id) || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData?.id),
    payment_method: "card", // Reaproveitamos a coluna existente — link de pagamento (Checkout Pro)
    status: "awaiting_payment",
    amount,
    description,
    payment_link: initPoint,
    invoice_url: initPoint,
    external_reference: externalRef,
    metadata: {
      mp_preference_id: mpData?.id,
      mp_environment: config.environment,
      payer_type: payer.type,
      document_type: payer.documentType,
      max_installments: maxInstallments,
      kind: "checkout_pro_link",
      expires_at: expirationDate,
    },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;
  return jsonResponse(data);
}

async function listCharges(req: Request): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");
  let q = supabase.from("payment_charges").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (method) q = q.eq("payment_method", method);
  const { data, error } = await q;
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
  const { supabase, userId } = await getAuthenticatedUser(req);
  const config = await getUserMPConfig(userId);
  const { data: charge, error: e1 } = await supabase.from("payment_charges").select("*").eq("id", id).single();
  if (e1) throw e1;

  // Preferences (Checkout Pro) não podem ser canceladas via API; só Pix/Boleto.
  if (charge.provider_charge_id && charge.payment_method !== "card") {
    try {
      await mpFetch(`/v1/payments/${charge.provider_charge_id}`, config, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      }, { operation: "cancel-charge", charge_id: id });
    } catch (err) {
      console.warn("[payments] cancel-warning", getErrorMessage(err));
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

  // ----- 1. Validar assinatura do Mercado Pago -----
  const webhookSecret = safeTrim(Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET"));
  if (!webhookSecret) {
    console.error("[payments] webhook-not-configured", "Webhook do Mercado Pago não configurado");
    return new Response(
      JSON.stringify({ error: "Webhook do Mercado Pago não configurado" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const signatureHeader = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const rawBody = await req.text();

  const sigParts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=").map((s) => s?.trim());
    if (k && v) sigParts[k] = v;
  }
  const ts = sigParts.ts;
  const v1 = sigParts.v1;

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!isObject(parsed)) throw new Error("not-object");
    payload = parsed;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const dataId = isObject(payload.data) && payload.data.id != null ? String(payload.data.id) : "";
  if (!ts || !v1) {
    console.error("[payments] webhook-invalid-signature", "missing x-signature ts/v1");
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  try {
    const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(template));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (computed !== v1) {
      console.error("[payments] webhook-invalid-signature", "hmac mismatch");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }
  } catch (e) {
    console.error("[payments] webhook-signature-error", getErrorMessage(e));
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  // ----- 2. Persistir evento e processar -----
  try {
  const { data: event } = await serviceClient
    .from("payment_events")
    .insert({
      provider: "mercadopago",
      event_type: String(payload.type || payload.action || "unknown"),
      payload,
    })
    .select("id")
    .single();
  const eventId = event?.id ?? null;

  if (payload.type === "payment" && isObject(payload.data) && payload.data.id) {
    const paymentId = String(payload.data.id);
    try {
      // Localiza a cobrança ANTES de chamar a API do MP, para descobrir
      // qual usuário (e portanto qual access_token) usar.
      const { data: matchByMp } = await serviceClient
        .from("payment_charges")
        .select("*")
        .eq("provider_charge_id", paymentId)
        .limit(1);
      let charges = matchByMp ?? [];

      // Sem match direto: tentamos via metadata (Checkout Pro guarda mp_preference_id).
      // Como não temos o external_reference ainda, faremos um lookup secundário
      // depois de obter os dados do pagamento.
      let charge = charges[0] ?? null;

      // Se ainda não encontramos a cobrança pelo provider_charge_id, precisamos
      // primeiro pegar o pagamento usando QUALQUER token configurado para
      // descobrir o external_reference. Estratégia: tentamos um token de qualquer
      // conexão recente — se falhar, registramos e saímos. Em produção, o webhook
      // do MP sempre vem da conta do dono, então podemos tentar primeiro com a
      // primeira conexão disponível como fallback de descoberta.
      let config: MPUserConfig | null = null;
      if (charge) {
        try { config = await getUserMPConfig(charge.user_id as string); } catch (e) {
          console.error("[payments] webhook-no-user-config", getErrorMessage(e));
        }
      } else {
        // Sem cobrança ainda: tenta por external_reference depois de buscar via
        // a primeira conexão disponível.
        const { data: anyConn } = await serviceClient
          .from("mp_connections").select("user_id").limit(1).maybeSingle();
        if (anyConn?.user_id) {
          try { config = await getUserMPConfig(anyConn.user_id as string); } catch (_e) { /* noop */ }
        }
      }

      if (!config) {
        console.warn("[payments] webhook-skip-no-config", JSON.stringify({ payment_id: paymentId }));
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const mpPayment = await mpFetch(`/v1/payments/${paymentId}`, config, {}, {
        operation: "webhook-fetch", payment_id: paymentId,
      });

      const externalRef = typeof mpPayment?.external_reference === "string"
        ? mpPayment.external_reference
        : null;

      if (!charge && externalRef) {
        const { data: matchByRef } = await serviceClient
          .from("payment_charges")
          .select("*")
          .eq("external_reference", externalRef)
          .limit(1);
        charges = matchByRef ?? [];
        charge = charges[0] ?? null;

        // Reabrimos o config no token correto do dono da cobrança.
        if (charge) {
          try { config = await getUserMPConfig(charge.user_id as string); } catch (_e) { /* noop */ }
        }
      }

      if (charge) {
        const mpStatus = String(mpPayment?.status || "pending");
        const mpStatusDetail = String(mpPayment?.status_detail || "");
        const isPaid = mpStatus === "approved" || mpStatusDetail === "accredited";
        const newStatus = mapMPStatus(mpStatus);
        const nowIso = new Date().toISOString();

        const updateData: Record<string, unknown> = {
          status: newStatus,
          metadata: {
            ...(typeof charge.metadata === "object" && charge.metadata ? charge.metadata : {}),
            mp_last_status: mpStatus,
            mp_status_detail: mpStatusDetail,
            mp_last_webhook_at: nowIso,
          },
        };

        if (isPaid) {
          updateData.paid_at = charge.paid_at ?? nowIso;

          // Idempotência: só mexe no financeiro se ainda não está marcado como pago
          const alreadyPaid = charge.status === "approved" && charge.financial_entry_id;

          if (!alreadyPaid) {
            let financialEntryId = charge.financial_entry_id as string | null;

            if (financialEntryId) {
              // Atualiza lançamento existente
              const { error: updErr } = await serviceClient
                .from("financial_entries")
                .update({
                  status: "pago",
                  paid_at: nowIso,
                  amount: charge.amount,
                  type: "entrada",
                })
                .eq("id", financialEntryId);
              if (updErr) {
                console.error("[payments] webhook-financial-update-error", updErr.message);
              } else {
                console.log("[payments] webhook-financial-updated", JSON.stringify({
                  charge_id: charge.id, financial_entry_id: financialEntryId,
                }));
              }
            } else {
              // Cria lançamento financeiro automaticamente
              const { data: created, error: insErr } = await serviceClient
                .from("financial_entries")
                .insert({
                  user_id: charge.user_id,
                  client_id: charge.client_id,
                  demand_id: charge.demand_id,
                  type: "entrada",
                  category: "pagamento_mercado_pago",
                  description:
                    charge.description?.trim()
                      ? `${charge.description} (Mercado Pago)`
                      : "Pagamento recebido via Mercado Pago",
                  amount: charge.amount,
                  status: "pago",
                  due_date: charge.due_date,
                  paid_at: nowIso,
                })
                .select("id")
                .single();

              if (insErr) {
                console.error("[payments] webhook-financial-insert-error", insErr.message);
              } else if (created?.id) {
                financialEntryId = created.id as string;
                updateData.financial_entry_id = financialEntryId;
                console.log("[payments] webhook-financial-created", JSON.stringify({
                  charge_id: charge.id, financial_entry_id: financialEntryId,
                }));
              }
            }
          } else {
            console.log("[payments] webhook-duplicate-ignored", JSON.stringify({
              charge_id: charge.id, payment_id: paymentId,
            }));
          }
        }

        await serviceClient.from("payment_charges").update(updateData).eq("id", charge.id);

        if (eventId) {
          await serviceClient
            .from("payment_events")
            .update({ processed: true, user_id: charge.user_id, charge_id: charge.id })
            .eq("id", eventId);
        }
      } else {
        console.warn("[payments] webhook-charge-not-found", JSON.stringify({
          payment_id: paymentId, external_reference: externalRef,
        }));
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error("[payments] webhook-error", JSON.stringify({ payment_id: paymentId, error: msg }));
      if (eventId) {
        await serviceClient.from("payment_events").update({ error_message: msg }).eq("id", eventId);
      }
    }
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[payments] webhook-fatal", getErrorMessage(e));
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/payments\/?/, "").replace(/\/$/, "");

    if (path === "webhook" && req.method === "POST") return await handleWebhook(req);
    if (path === "config-status" && req.method === "GET") return await getConfigStatus(req);
    if (path === "create-pix" && req.method === "POST") return await createPix(req);
    if (path === "create-boleto" && req.method === "POST") return await createBoleto(req);
    if (path === "create-link" && req.method === "POST") return await createPaymentLink(req);
    if (path === "" && req.method === "GET") return await listCharges(req);

    const idMatch = path.match(/^([a-f0-9-]+)$/);
    if (idMatch && req.method === "GET") return await getCharge(req, idMatch[1]);

    const cancelMatch = path.match(/^([a-f0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") return await cancelCharge(req, cancelMatch[1]);

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (error instanceof HttpError && error.payload) {
      return jsonResponse({
        error: error.payload.error ?? getErrorMessage(error),
        message: error.payload.message ?? getErrorMessage(error),
        detail: error.payload.detail ?? null,
        status: error.payload.status ?? null,
        status_detail: error.payload.status_detail ?? null,
        code: error.payload.code ?? null,
        cause: error.payload.cause ?? null,
        http_status: error.payload.http_status ?? status,
      }, status);
    }
    return jsonResponse({ error: getErrorMessage(error) }, status);
  }
});
