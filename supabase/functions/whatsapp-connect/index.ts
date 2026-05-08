import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

function getMetaConfig() {
  const metaAppId = Deno.env.get("META_APP_ID") || Deno.env.get("VITE_META_APP_ID") || "";
  const metaConfigId = Deno.env.get("VITE_META_CONFIG_ID") || Deno.env.get("META_CONFIG_ID") || "";
  const metaAppSecret = Deno.env.get("META_APP_SECRET") || "";

  return { metaAppId, metaConfigId, metaAppSecret };
}

function metaConfigStatus() {
  const { metaAppId, metaConfigId, metaAppSecret } = getMetaConfig();

  return {
    hasMetaAppId: Boolean(metaAppId),
    hasMetaAppSecret: Boolean(metaAppSecret),
    hasMetaConfigId: Boolean(metaConfigId),
    ready: Boolean(metaAppId && metaAppSecret && metaConfigId),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isConfigStatusRoute = url.pathname.endsWith("/config-status");
    let requestBody: any = null;

    if (req.method !== "GET") {
      try {
        requestBody = await req.json();
      } catch (_) {
        requestBody = null;
      }
    }

    if (isConfigStatusRoute || requestBody?.action === "config-status") {
      return json(metaConfigStatus());
    }

    // ── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Secrets ──────────────────────────────────────────
    const { metaAppId: META_APP_ID, metaConfigId: META_CONFIG_ID, metaAppSecret: META_APP_SECRET } = getMetaConfig();

    if (requestBody?.action === "public-config") {
      if (!META_APP_ID || !META_CONFIG_ID) {
        console.error("Missing Meta public config", {
          hasMetaAppId: Boolean(META_APP_ID),
          hasMetaConfigId: Boolean(META_CONFIG_ID),
        });
        return json({ error: "Configuração pública da Meta indisponível." }, 500);
      }

      return json({ appId: META_APP_ID, configId: META_CONFIG_ID });
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("Missing required Meta backend config", metaConfigStatus());
      return json({ error: "META_APP_ID e META_APP_SECRET não configurados no servidor." }, 500);
    }

    // ── Service role client ──────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { code, wabaId, phoneNumberId } = requestBody || {};

    if (!code) {
      return json({ error: "Código de autorização (code) ausente." }, 400);
    }

    // ── Step 1: Exchange code for Business Access Token ──
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&code=${encodeURIComponent(code)}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData?.error?.message || "Falha ao trocar código por token.";
      await supabase.from("whatsapp_logs").insert({
        event_type: "embedded_signup_token_error",
        user_id: user.id,
        payload: tokenData,
        error_message: errMsg,
      });
      return json({ error: errMsg }, 400);
    }

    const accessToken = tokenData.access_token;

    // ── Step 2: Get phone number details (if we have the ID) ──
    let phoneNumber = "";
    let displayName = "";
    let resolvedPhoneNumberId = phoneNumberId;
    let resolvedWabaId = wabaId;

    // If we got the waba_id but not the phone_number_id, fetch phone numbers
    if (resolvedWabaId && !resolvedPhoneNumberId) {
      try {
        const phonesRes = await fetch(
          `${GRAPH_API}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`
        );
        const phonesData = await phonesRes.json();
        if (phonesData?.data?.[0]) {
          resolvedPhoneNumberId = phonesData.data[0].id;
          phoneNumber = phonesData.data[0].display_phone_number || "";
          displayName = phonesData.data[0].verified_name || "";
        }
      } catch (_) { /* non-critical */ }
    }

    // If we have the phone_number_id, get its details
    if (resolvedPhoneNumberId) {
      try {
        const phoneRes = await fetch(
          `${GRAPH_API}/${resolvedPhoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status&access_token=${accessToken}`
        );
        const phoneData = await phoneRes.json();
        if (phoneData) {
          phoneNumber = phoneData.display_phone_number || phoneNumber;
          displayName = phoneData.verified_name || displayName;
        }
      } catch (_) { /* non-critical */ }
    }

    // If we don't have the WABA ID yet, try to find it from the token's debug info
    if (!resolvedWabaId) {
      try {
        const debugRes = await fetch(
          `${GRAPH_API}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
        );
        const debugData = await debugRes.json();
        const granularScopes = debugData?.data?.granular_scopes || [];
        const waScope = granularScopes.find((s: any) =>
          s.permission === "whatsapp_business_management"
        );
        if (waScope?.target_ids?.[0]) {
          resolvedWabaId = waScope.target_ids[0];
        }
      } catch (_) { /* non-critical */ }
    }

    // ── Step 3: Subscribe app to WABA webhooks ──
    if (resolvedWabaId) {
      try {
        await fetch(`${GRAPH_API}/${resolvedWabaId}/subscribed_apps`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
      } catch (_) { /* non-critical */ }
    }

    // ── Step 4: Register phone number for Cloud API ──
    if (resolvedPhoneNumberId) {
      try {
        await fetch(`${GRAPH_API}/${resolvedPhoneNumberId}/register`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            pin: "000000",
          }),
        });
      } catch (_) { /* non-critical, may already be registered */ }
    }

    // ── Step 5: Save connection ──────────────────────────
    if (!resolvedPhoneNumberId) {
      return json({ error: "Não foi possível identificar o Phone Number ID. Tente conectar novamente." }, 400);
    }

    const { data: savedConn, error: saveError } = await supabase
      .from("whatsapp_connections")
      .upsert({
        user_id: user.id,
        provider: "meta_whatsapp",
        phone_number_id: resolvedPhoneNumberId,
        business_account_id: resolvedWabaId || null,
        phone_number: phoneNumber || null,
        display_name: displayName || null,
        access_token_encrypted: accessToken,
        status: "connected",
        metadata: {
          connected_via: "embedded_signup",
          connected_at: new Date().toISOString(),
        },
      }, {
        onConflict: "user_id,phone_number_id",
      })
      .select("id, phone_number_id, phone_number, display_name, business_account_id, status, webhook_verify_token, created_at")
      .single();

    if (saveError) {
      return json({ error: "Erro ao salvar conexão: " + saveError.message }, 500);
    }

    // Log success
    await supabase.from("whatsapp_logs").insert({
      event_type: "embedded_signup_success",
      user_id: user.id,
      payload: {
        waba_id: resolvedWabaId,
        phone_number_id: resolvedPhoneNumberId,
        phone_number: phoneNumber,
        display_name: displayName,
      },
    });

    return json({
      success: true,
      connection: savedConn,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
