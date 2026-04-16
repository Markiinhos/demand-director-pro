import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
  return token;
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
  };
  return map[status] || "pending";
}

function generateExternalRef(): string {
  return `DSO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");

  return { supabase, userId: data.claims.sub as string };
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function mpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data));
  return data;
}

// ──────── PIX ────────
async function createPix(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await req.json();
  const { client_id, amount, description, budget_id, demand_id, financial_entry_id, due_date, payer_email, payer_first_name, payer_last_name, payer_cpf } = body;

  if (!client_id || !amount || !description) {
    return new Response(JSON.stringify({ error: "client_id, amount, description são obrigatórios" }), { status: 400, headers: corsHeaders });
  }

  const externalRef = generateExternalRef();
  const expDate = due_date ? new Date(due_date).toISOString() : new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const mpData = await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      transaction_amount: Number(amount),
      description,
      payment_method_id: "pix",
      external_reference: externalRef,
      date_of_expiration: expDate,
      payer: {
        email: payer_email || "cliente@email.com",
        first_name: payer_first_name || "Cliente",
        last_name: payer_last_name || "",
        identification: payer_cpf ? { type: "CPF", number: payer_cpf } : undefined,
      },
    }),
  });

  const charge = {
    user_id: userId,
    client_id,
    budget_id: budget_id || null,
    demand_id: demand_id || null,
    financial_entry_id: financial_entry_id || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData.id),
    payment_method: "pix",
    status: mapMPStatus(mpData.status),
    amount: Number(amount),
    description,
    due_date: due_date || null,
    pix_qr_code: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
    pix_copy_paste: mpData.point_of_interaction?.transaction_data?.qr_code || null,
    external_reference: externalRef,
    metadata: { mp_response_id: mpData.id },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ──────── BOLETO ────────
async function createBoleto(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await req.json();
  const { client_id, amount, description, budget_id, demand_id, financial_entry_id, due_date, payer_email, payer_first_name, payer_last_name, payer_cpf } = body;

  if (!client_id || !amount || !description) {
    return new Response(JSON.stringify({ error: "client_id, amount, description são obrigatórios" }), { status: 400, headers: corsHeaders });
  }

  const externalRef = generateExternalRef();
  const dueDate = due_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const mpData = await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      transaction_amount: Number(amount),
      description,
      payment_method_id: "bolbradesco",
      external_reference: externalRef,
      date_of_expiration: new Date(dueDate + "T23:59:59").toISOString(),
      payer: {
        email: payer_email || "cliente@email.com",
        first_name: payer_first_name || "Cliente",
        last_name: payer_last_name || "",
        identification: payer_cpf ? { type: "CPF", number: payer_cpf } : undefined,
      },
    }),
  });

  const charge = {
    user_id: userId,
    client_id,
    budget_id: budget_id || null,
    demand_id: demand_id || null,
    financial_entry_id: financial_entry_id || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData.id),
    payment_method: "boleto",
    status: mapMPStatus(mpData.status),
    amount: Number(amount),
    description,
    due_date: dueDate,
    bank_slip_url: mpData.transaction_details?.external_resource_url || null,
    invoice_url: mpData.transaction_details?.external_resource_url || null,
    external_reference: externalRef,
    metadata: { mp_response_id: mpData.id },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ──────── CARD ────────
async function createCard(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthenticatedUser(req);
  const body = await req.json();
  const { client_id, amount, description, budget_id, demand_id, financial_entry_id, token, installments, payer_email, payer_cpf, payment_method_id } = body;

  if (!client_id || !amount || !description || !token) {
    return new Response(JSON.stringify({ error: "client_id, amount, description, token são obrigatórios" }), { status: 400, headers: corsHeaders });
  }

  const externalRef = generateExternalRef();

  const mpData = await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      transaction_amount: Number(amount),
      description,
      token,
      installments: installments || 1,
      payment_method_id: payment_method_id || undefined,
      external_reference: externalRef,
      payer: {
        email: payer_email || "cliente@email.com",
        identification: payer_cpf ? { type: "CPF", number: payer_cpf } : undefined,
      },
    }),
  });

  const charge = {
    user_id: userId,
    client_id,
    budget_id: budget_id || null,
    demand_id: demand_id || null,
    financial_entry_id: financial_entry_id || null,
    provider: "mercadopago",
    provider_charge_id: String(mpData.id),
    payment_method: "card",
    status: mapMPStatus(mpData.status),
    amount: Number(amount),
    description,
    card_last4: mpData.card?.last_four_digits || null,
    paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
    external_reference: externalRef,
    metadata: { mp_response_id: mpData.id, card_brand: mpData.payment_method_id },
  };

  const { data, error } = await supabase.from("payment_charges").insert(charge).select().single();
  if (error) throw error;

  // If approved immediately, update related financial entry
  if (mpData.status === "approved" && financial_entry_id) {
    await supabase.from("financial_entries").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", financial_entry_id);
  }

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ──────── LIST / GET ────────
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

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getCharge(req: Request, id: string): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const { data, error } = await supabase.from("payment_charges").select("*").eq("id", id).single();
  if (error) throw error;
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function cancelCharge(req: Request, id: string): Promise<Response> {
  const { supabase } = await getAuthenticatedUser(req);
  const { data: charge, error: fetchErr } = await supabase.from("payment_charges").select("*").eq("id", id).single();
  if (fetchErr) throw fetchErr;

  if (charge.provider_charge_id) {
    try {
      await mpFetch(`/v1/payments/${charge.provider_charge_id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      });
    } catch (_) { /* may fail if already cancelled */ }
  }

  const { data, error } = await supabase.from("payment_charges").update({ status: "canceled" }).eq("id", id).select().single();
  if (error) throw error;

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ──────── WEBHOOK ────────
async function handleWebhook(req: Request): Promise<Response> {
  const serviceClient = getServiceClient();

  const body = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Log event
  await serviceClient.from("payment_events").insert({
    provider: "mercadopago",
    event_type: String(payload.type || payload.action || "unknown"),
    payload,
  });

  // Process payment notification
  if (payload.type === "payment" && payload.data) {
    const paymentId = String((payload.data as Record<string, unknown>).id);

    try {
      // Fetch payment details from MP
      const mpPayment = await mpFetch(`/v1/payments/${paymentId}`);
      const newStatus = mapMPStatus(mpPayment.status);

      // Find charge by provider_charge_id
      const { data: charges } = await serviceClient
        .from("payment_charges")
        .select("*")
        .eq("provider_charge_id", paymentId);

      if (charges && charges.length > 0) {
        const charge = charges[0];
        const updateData: Record<string, unknown> = { status: newStatus };

        if (mpPayment.status === "approved") {
          updateData.paid_at = new Date().toISOString();

          // Update related financial entry
          if (charge.financial_entry_id) {
            await serviceClient.from("financial_entries").update({
              status: "pago",
              paid_at: new Date().toISOString(),
            }).eq("id", charge.financial_entry_id);
          }
        }

        await serviceClient.from("payment_charges").update(updateData).eq("id", charge.id);

        // Mark event as processed
        await serviceClient.from("payment_events").update({ processed: true, user_id: charge.user_id })
          .eq("payload->>data->>id", paymentId)
          .eq("processed", false);
      }
    } catch (e) {
      await serviceClient.from("payment_events").insert({
        provider: "mercadopago",
        event_type: "webhook_error",
        payload,
        error_message: e.message,
      });
    }
  }

  return new Response("OK", { status: 200 });
}

// ──────── ROUTER ────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/payments\/?/, "").replace(/\/$/, "");

    // Webhook - no auth required
    if (path === "webhook" && req.method === "POST") {
      return await handleWebhook(req);
    }

    // Authenticated routes
    if (path === "create-pix" && req.method === "POST") return await createPix(req);
    if (path === "create-boleto" && req.method === "POST") return await createBoleto(req);
    if (path === "create-card" && req.method === "POST") return await createCard(req);
    if (path === "" && req.method === "GET") return await listCharges(req);

    // Routes with ID
    const idMatch = path.match(/^([a-f0-9-]+)$/);
    if (idMatch && req.method === "GET") return await getCharge(req, idMatch[1]);

    const cancelMatch = path.match(/^([a-f0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") return await cancelCharge(req, cancelMatch[1]);

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
  } catch (error) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
