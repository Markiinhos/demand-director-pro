// Cria um checkout de assinatura no Mercado Pago (Preapproval) ou ativa o Free.
// Recebe { plan_id }. Usa o token MP do próprio usuário (mp_connections) se houver,
// senão usa MERCADO_PAGO_ACCESS_TOKEN da plataforma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { plan_id } = await req.json().catch(() => ({}));
    if (!plan_id) return json({ error: "missing_plan_id" }, 400);

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .maybeSingle();
    if (!plan) return json({ error: "plan_not_found" }, 404);

    // Free → ativa direto
    if (Number(plan.price_brl) <= 0) {
      await admin.from("user_subscriptions").upsert({
        user_id: user.id,
        plan_id: plan.id,
        status: "active",
        canceled_at: null,
      });
      return json({ free: true });
    }

    // Pago → cria preapproval no Mercado Pago
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpToken) return json({ error: "mp_not_configured" }, 500);

    const origin = req.headers.get("origin") ?? "https://app.lovable.dev";
    const body = {
      reason: `DesignOS — ${plan.name}`,
      external_reference: `${user.id}:${plan.id}`,
      payer_email: user.email,
      back_url: `${origin}/planos?status=success`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(plan.price_brl),
        currency_id: "BRL",
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preapproval error", mpJson);
      return json({ error: "mp_error", details: mpJson }, 400);
    }

    // Salva o preapproval pendente
    await admin.from("user_subscriptions").upsert({
      user_id: user.id,
      plan_id: plan.id,
      status: "trialing",
      mp_preapproval_id: mpJson.id,
    });

    return json({ init_point: mpJson.init_point, preapproval_id: mpJson.id });
  } catch (e) {
    console.error(e);
    return json({ error: "internal_error", message: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}