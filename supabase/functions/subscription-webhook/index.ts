// Webhook do Mercado Pago para eventos de Preapproval (assinaturas).
// Configure no painel MP: URL = .../functions/v1/subscription-webhook  topic=preapproval
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Valida assinatura do webhook MP usando MERCADO_PAGO_WEBHOOK_SECRET.
// Doc: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
async function validateMpSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) return true; // sem secret configurado → não bloqueia (modo legado)
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";
  if (!xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.trim().split("=").map((s) => s.trim()))
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === v1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    const valid = await validateMpSignature(req, rawBody);
    if (!valid) {
      console.warn("Invalid MP webhook signature");
      return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
    }

    const url = new URL(req.url);
    const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
    const id = url.searchParams.get("id") ?? url.searchParams.get("data.id") ?? "";

    let body: any = null;
    try { body = rawBody ? JSON.parse(rawBody) : null; } catch { /* ignore */ }
    const preapprovalId = body?.data?.id ?? id;

    if (!topic.includes("preapproval") || !preapprovalId || !mpToken) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    // Busca status da preapproval no MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const preapproval = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP preapproval fetch error", preapproval);
      return new Response(JSON.stringify({ ok: false }), { status: 200 });
    }

    const externalRef: string = preapproval.external_reference ?? "";
    const [userId, planId] = externalRef.split(":");
    if (!userId) return new Response(JSON.stringify({ ok: true, no_user: true }), { status: 200 });

    // Mapeia status MP → nosso enum
    const statusMap: Record<string, string> = {
      authorized: "active",
      paused: "paused",
      cancelled: "canceled",
      pending: "trialing",
    };
    const newStatus = statusMap[preapproval.status] ?? "trialing";

    await admin.from("user_subscriptions").upsert({
      user_id: userId,
      plan_id: planId || "pro",
      status: newStatus,
      mp_preapproval_id: preapprovalId,
      current_period_end: preapproval.next_payment_date ?? null,
      canceled_at: preapproval.status === "cancelled" ? new Date().toISOString() : null,
    });

    // Notifica o usuário
    if (newStatus === "active") {
      await admin.from("notifications").insert({
        user_id: userId,
        title: "Assinatura ativada 🎉",
        message: "Bem-vindo ao plano Pro! Aproveite todos os recursos.",
        type: "success",
        link: "/planos",
      });
    } else if (newStatus === "canceled") {
      await admin.from("notifications").insert({
        user_id: userId,
        title: "Assinatura cancelada",
        message: "Sua assinatura foi cancelada. Você continua no plano Free.",
        type: "warning",
        link: "/planos",
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }
});