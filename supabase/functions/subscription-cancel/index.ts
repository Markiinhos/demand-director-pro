// Cancela a assinatura ativa do usuário no Mercado Pago e marca como cancelada no banco.
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
    if (!authHeader) return json({ error: "missing_auth" }, 401);

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

    const { data: sub } = await admin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub) return json({ error: "no_subscription" }, 404);

    // Cancela no MP se houver preapproval
    if (sub.mp_preapproval_id) {
      const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
      if (mpToken) {
        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${mpToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "cancelled" }),
          },
        );
        if (!mpRes.ok) {
          const err = await mpRes.json().catch(() => ({}));
          console.error("MP cancel error", err);
        }
      }
    }

    // Atualiza local: volta pro Free
    await admin.from("user_subscriptions").update({
      status: "canceled",
      plan_id: "free",
      canceled_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Assinatura cancelada",
      message: "Você voltou ao plano Free. Pode reativar quando quiser.",
      type: "info",
      link: "/planos",
    });

    return json({ ok: true });
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