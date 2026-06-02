import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";
const META_OAUTH_DIALOG = "https://www.facebook.com/v22.0/dialog/oauth";
const APP_RETURN_URI = "https://demand-director-pro.lovable.app/whatsapp";
const OAUTH_CALLBACK_REDIRECT_URI = "https://lwabrwtqwveqrkwegikg.supabase.co/functions/v1/whatsapp-connect";
const META_OAUTH_SCOPES = "whatsapp_business_management,whatsapp_business_messaging";

type ConnectRequestBody = {
  action?: string;
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  redirectUri?: string;
};

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
};

type GranularScope = {
  permission?: string;
  scope?: string;
  target_ids?: string[];
};

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
    ready: Boolean(metaAppId && metaAppSecret),
  };
}

function base64UrlEncode(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signStatePayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createOAuthState(userId: string, secret: string) {
  const payload: OAuthStatePayload = { userId, nonce: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 15 * 60 };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signStatePayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifyOAuthState(state: string | null, secret: string): Promise<OAuthStatePayload | null> {
  if (!state || !state.includes(".")) return null;
  const [encodedPayload, signature] = state.split(".");
  const expectedSignature = await signStatePayload(encodedPayload, secret);
  if (signature !== expectedSignature) return null;
  const payloadText = new TextDecoder().decode(base64UrlDecode(encodedPayload));
  const payload = JSON.parse(payloadText) as OAuthStatePayload;
  if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(error: string, details?: Record<string, unknown>) {
  return jsonOk({ success: false, error, ...details });
}
function jsonSuccess(data: unknown) {
  return jsonOk({ success: true, ...data as Record<string, unknown> });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isConfigStatusRoute = url.pathname.endsWith("/config-status");

    console.log("[whatsapp-connect] ════════════════════════════════════");
    console.log("[whatsapp-connect] Incoming:", req.method, url.pathname, url.search);

    // ── Parse body ────────────────────────────────────────
    let requestBody: ConnectRequestBody | null = null;
    let rawBodyPreview = "(not read)";

    if (req.method !== "GET") {
      try {
        const rawBody = await req.text();
        if (rawBody) {
          requestBody = JSON.parse(rawBody);
          rawBodyPreview = JSON.stringify({
            ...requestBody,
            code: requestBody?.code ? `*** length=${requestBody.code.length}` : undefined,
          }).substring(0, 300);
          console.log("[whatsapp-connect] Raw body (masked):", rawBodyPreview);
          console.log("[whatsapp-connect] Parsed → action:", requestBody?.action, "| code:", Boolean(requestBody?.code), "| wabaId:", requestBody?.wabaId || "none", "| phoneNumberId:", requestBody?.phoneNumberId || "none");
        } else {
          rawBodyPreview = "(empty)";
          console.log("[whatsapp-connect] Raw body:", rawBodyPreview);
        }
      } catch (e: unknown) {
        console.error("[whatsapp-connect] ❌ Body parse FAILED:", e instanceof Error ? e.message : String(e));
        requestBody = null;
      }
    }

    const actionParam = url.searchParams.get("action");
    const codeParam = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const metaErrorParam = url.searchParams.get("error") || url.searchParams.get("error_message");
    const { metaAppId: META_APP_ID, metaConfigId: META_CONFIG_ID, metaAppSecret: META_APP_SECRET } = getMetaConfig();
    const oauthDialogRedirectUri = OAUTH_CALLBACK_REDIRECT_URI;
    const tokenExchangeRedirectUri = OAUTH_CALLBACK_REDIRECT_URI;

    let userId = "";
    let isFromOAuthCallback = false;

    const redirectToApp = (status: "connected" | "error", message?: string) => {
      const returnUrl = new URL(APP_RETURN_URI);
      if (status === "connected") returnUrl.searchParams.set("success", "1");
      if (status === "error") returnUrl.searchParams.set("whatsapp_error", message?.substring(0, 180) || "unknown");
      console.log("[whatsapp-connect] LOG redirect-back-url:", returnUrl.toString());
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: returnUrl.toString() } });
    };

    const respondError = (error: string, details?: Record<string, unknown>) => {
      if (isFromOAuthCallback) return redirectToApp("error", error);
      return jsonError(error, details);
    };
    const respondSuccess = (data: unknown) => {
      if (isFromOAuthCallback) return redirectToApp("connected");
      return jsonSuccess(data);
    };

    // ── config-status (NO auth) ──────────────────────────
    if (isConfigStatusRoute || requestBody?.action === "config-status" || actionParam === "config-status") {
      return jsonOk(metaConfigStatus());
    }

    // ── Meta OAuth error callback ────────────────────────
    if (req.method === "GET" && metaErrorParam) {
      console.error("[whatsapp-connect] ❌ Meta returned error:", Object.fromEntries(url.searchParams.entries()));
      return redirectToApp("error", metaErrorParam);
    }

    // ── OAuth GET callback (manual Meta OAuth redirect flow) ────────
    if (req.method === "GET" && codeParam) {
      console.log("[whatsapp-connect] LOG callback-received (GET)");
      isFromOAuthCallback = true;

      const statePayload = await verifyOAuthState(stateParam, META_APP_SECRET).catch(() => null);
      if (statePayload?.userId) {
        userId = statePayload.userId;
        console.log("[whatsapp-connect] ✅ OAuth callback userId from state:", userId);
      }
      requestBody = { code: codeParam, wabaId: url.searchParams.get("waba_id") || undefined, phoneNumberId: url.searchParams.get("phone_number_id") || undefined };
    }

    // ── Auth ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");

    if (!userId && isFromOAuthCallback) {
      return redirectToApp("error", "Sessão OAuth inválida ou expirada. Inicie a conexão novamente pelo app.");
    }

    if (!userId && !authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized - token não fornecido", { _authMissing: true });
    }

    if (!userId) {
      const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        console.error("[whatsapp-connect] ❌ Auth failed:", authError?.message);
        return jsonError("Unauthorized", { _authError: authError?.message || "null" });
      }
      userId = user.id;
      console.log("[whatsapp-connect] ✅ Auth user:", userId);
    }

    // ── public-config (auth required) ────────────────────
    if (requestBody?.action === "public-config" || actionParam === "public-config") {
      if (!META_APP_ID) return jsonError("Configuração pública indisponível.");
      return jsonOk({ appId: META_APP_ID, configId: META_CONFIG_ID });
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return respondError("META_APP_ID e META_APP_SECRET precisam estar configurados.", metaConfigStatus());
    }

    // ── oauth-url (legacy, still supported) ──────────────
    if (requestBody?.action === "oauth-url" || actionParam === "oauth-url") {
      const state = await createOAuthState(userId, META_APP_SECRET);
      const oauthUrl = new URL(META_OAUTH_DIALOG);
      oauthUrl.searchParams.set("client_id", META_APP_ID);
      oauthUrl.searchParams.set("redirect_uri", oauthDialogRedirectUri);
      oauthUrl.searchParams.set("scope", META_OAUTH_SCOPES);
      oauthUrl.searchParams.set("response_type", "code");
      oauthUrl.searchParams.set("state", state);
      return jsonOk({ oauthUrl: oauthUrl.toString(), redirectUri: oauthDialogRedirectUri });
    }

    // ── Service role client ──────────────────────────────
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { code, wabaId, phoneNumberId } = requestBody || {};

    if (!code) {
      return respondError("Código de autorização (code) ausente.", { receivedBodyKeys: requestBody ? Object.keys(requestBody) : null });
    }

    // ══════════════════════════════════════════════════════
    // STEP 1: Exchange code for token
    // Manual OAuth uses the Edge Function URL as the OAuth callback and token-exchange redirect_uri.
    // ══════════════════════════════════════════════════════
    console.log("[whatsapp-connect] LOG code-exchange-start");
    console.log("[whatsapp-connect] isFromOAuthCallback:", isFromOAuthCallback, "| codeLen:", code.length);
    console.log("[whatsapp-connect] code recebido:", Boolean(code), "| codeLen:", code.length);

    console.log("[whatsapp-connect] ════ redirect_uri diagnostic ════");
    console.log("oauth_dialog_redirect_uri", oauthDialogRedirectUri);
    console.log("token_exchange_redirect_uri", tokenExchangeRedirectUri);
    console.log("client_sent_redirect_uri", requestBody?.redirectUri || "(none)");
    console.log("[whatsapp-connect] redirect_uri enviado no token exchange:", tokenExchangeRedirectUri);
    console.log("[whatsapp-connect] token exchange redirect_uri omitted:", false);
    console.log("[whatsapp-connect] isFromOAuthCallback:", isFromOAuthCallback);
    console.log("[whatsapp-connect] ════════════════════════════════════════════════════");

    const tokenExchangeUrl = `${GRAPH_API}/oauth/access_token`;
    const tokenExchangeBody = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      code,
      redirect_uri: tokenExchangeRedirectUri,
    });
    const tokenExchangeDebug = {
      oauth_dialog_redirect_uri: oauthDialogRedirectUri,
      token_exchange_redirect_uri: tokenExchangeRedirectUri,
      token_exchange_redirect_uri_omitted: false,
      app_id: META_APP_ID,
      graph_endpoint: tokenExchangeUrl,
    };
    const tokenExchangePayloadForLog = {
      client_id: META_APP_ID,
      code: `*** length=${code.length}`,
      redirect_uri: tokenExchangeRedirectUri,
    };

    console.log("TOKEN_EXCHANGE_REDIRECT_URI_FINAL", tokenExchangeRedirectUri);
    console.log("Backend token exchange redirect_uri:", tokenExchangeRedirectUri);
    console.log("[whatsapp-connect] TOKEN EXCHANGE final POST URL:", tokenExchangeUrl);
    console.log("[whatsapp-connect] TOKEN EXCHANGE payload sem client_secret:", JSON.stringify(tokenExchangePayloadForLog));
    console.log("[whatsapp-connect] TOKEN EXCHANGE redirect_uri omitted or sent:", "sent");
    console.log("[whatsapp-connect] TOKEN EXCHANGE debug sanitized:", JSON.stringify(tokenExchangeDebug));

    const tokenRes = await fetch(tokenExchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenExchangeBody.toString(),
    });
    const tokenResData = await tokenRes.json();
    const safeTokenResData = tokenResData?.access_token
      ? { ...tokenResData, access_token: `*** length=${String(tokenResData.access_token).length}` }
      : tokenResData;
    console.log("[whatsapp-connect] resposta bruta da Meta (token exchange, token masked):", JSON.stringify(safeTokenResData));

    let tokenData: Record<string, unknown> | null = null;
    let lastTokenError = "";

    if (tokenRes.ok && tokenResData.access_token) {
      console.log("[whatsapp-connect] ✅ Token exchange SUCCESS, token length:", tokenResData.access_token.length);
      tokenData = tokenResData;
    } else {
      lastTokenError = tokenResData?.error?.message || JSON.stringify(tokenResData?.error) || "Unknown";
      console.error("[whatsapp-connect] ❌ Token exchange FAILED:", lastTokenError);
      console.error("[whatsapp-connect] Full error response:", JSON.stringify(tokenResData));
    }

    if (!tokenData?.access_token) {
      console.error("[whatsapp-connect] ❌ ALL token exchange attempts FAILED:", lastTokenError);
      try {
        await supabase.from("whatsapp_logs").insert({ event_type: "token_error", user_id: userId, error_message: lastTokenError, payload: { ...tokenExchangeDebug, metaResponse: tokenResData } });
      } catch (_) { /* ignore */ }
      return respondError(`Token exchange falhou: ${lastTokenError}`, tokenExchangeDebug);
    }

    console.log("[whatsapp-connect] LOG code-exchange-success");
    const accessToken = tokenData.access_token as string;

    // ══════════════════════════════════════════════════════
    // STEP 2: Resolve WABA ID + Phone Number ID
    // ══════════════════════════════════════════════════════
    let phoneNumber = "";
    let displayName = "";
    let resolvedPhoneNumberId = phoneNumberId;
    let resolvedWabaId = wabaId;

    // 2a: debug_token to discover WABA + Phone from scopes
    console.log("[whatsapp-connect] LOG graph-waba-fetch-start");
    try {
      const debugRes = await fetch(`${GRAPH_API}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`);
      const debugData = await debugRes.json();
      console.log("[whatsapp-connect] debug_token:", JSON.stringify(debugData)?.substring(0, 800));

      const scopes: GranularScope[] = Array.isArray(debugData?.data?.granular_scopes) ? debugData.data.granular_scopes : [];
      for (const s of scopes) {
        console.log("[whatsapp-connect]   scope:", s.scope || s.permission, "→", s.target_ids);
      }

      if (!resolvedWabaId) {
        const wa =
          scopes.find(s => (s.scope || s.permission) === "whatsapp_business_management") ||
          scopes.find(s => (s.scope || s.permission) === "whatsapp_business_messaging");
        if (wa?.target_ids?.[0]) { resolvedWabaId = wa.target_ids[0]; console.log("[whatsapp-connect] ✅ captured_waba_id (debug):", resolvedWabaId); }
      }
      console.log("[whatsapp-connect] captured_waba_id:", resolvedWabaId || "(none)");
      console.log("[whatsapp-connect] captured_phone_number_id (initial):", resolvedPhoneNumberId || "(none)");
      console.log("[whatsapp-connect] LOG graph-waba-fetch-success");
    } catch (e: unknown) {
      console.error("[whatsapp-connect] debug_token error:", e instanceof Error ? e.message : e);
    }

    // 2b: Fetch phone numbers from WABA if needed
    if (resolvedWabaId && !resolvedPhoneNumberId) {
      try {
        const r = await fetch(`${GRAPH_API}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`);
        const d = await r.json();
        if (d?.data?.[0]) {
          resolvedPhoneNumberId = d.data[0].id;
          phoneNumber = d.data[0].display_phone_number || "";
          displayName = d.data[0].verified_name || "";
          console.log("[whatsapp-connect] ✅ Phone from WABA:", resolvedPhoneNumberId);
        }
      } catch (e: unknown) { console.error("[whatsapp-connect] WABA phones error:", e instanceof Error ? e.message : e); }
    }

    // 2c: Get phone details if we have phone ID
    if (resolvedPhoneNumberId) {
      console.log("[whatsapp-connect] LOG phone-number-detected:", resolvedPhoneNumberId);
      try {
        const r = await fetch(`${GRAPH_API}/${resolvedPhoneNumberId}?fields=verified_name,display_phone_number,quality_rating&access_token=${accessToken}`);
        const d = await r.json();
        if (d && !d.error) { phoneNumber = d.display_phone_number || phoneNumber; displayName = d.verified_name || displayName; }
      } catch (e: unknown) { console.error("[whatsapp-connect] Phone detail error:", e instanceof Error ? e.message : e); }
    }

    // 2d: Alternative WABA discovery
    if (!resolvedWabaId) {
      try {
        const bizRes = await fetch(`${GRAPH_API}/me/businesses?access_token=${accessToken}`);
        const bizData = await bizRes.json();
        if (bizData?.data?.[0]?.id) {
          const wabaRes = await fetch(`${GRAPH_API}/${bizData.data[0].id}/owned_whatsapp_business_accounts?access_token=${accessToken}`);
          const wabaData = await wabaRes.json();
          if (wabaData?.data?.[0]?.id) { resolvedWabaId = wabaData.data[0].id; console.log("[whatsapp-connect] ✅ WABA from /me/businesses:", resolvedWabaId); }
        }
      } catch (e: unknown) { console.error("[whatsapp-connect] Alt WABA error:", e instanceof Error ? e.message : e); }
    }

    // 2e: Last resort phone from newly discovered WABA
    if (resolvedWabaId && !resolvedPhoneNumberId) {
      try {
        const r = await fetch(`${GRAPH_API}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`);
        const d = await r.json();
        if (d?.data?.[0]) {
          resolvedPhoneNumberId = d.data[0].id;
          phoneNumber = d.data[0].display_phone_number || phoneNumber;
          displayName = d.data[0].verified_name || displayName;
          console.log("[whatsapp-connect] ✅ Phone (last resort):", resolvedPhoneNumberId);
        }
      } catch (e: unknown) { console.error("[whatsapp-connect] Last resort phone error:", e instanceof Error ? e.message : e); }
    }

    // ══════════════════════════════════════════════════════
    // STEP 3: Subscribe app to WABA webhooks
    // ══════════════════════════════════════════════════════
    if (resolvedWabaId) {
      try {
        const r = await fetch(`${GRAPH_API}/${resolvedWabaId}/subscribed_apps`, { method: "POST", headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" } });
        console.log("[whatsapp-connect] Subscribe:", await r.json());
      } catch (e: unknown) { console.error("[whatsapp-connect] Subscribe error:", e instanceof Error ? e.message : e); }
    }

    // ══════════════════════════════════════════════════════
    // STEP 4: Register phone for Cloud API
    // ══════════════════════════════════════════════════════
    if (resolvedPhoneNumberId) {
      try {
        const r = await fetch(`${GRAPH_API}/${resolvedPhoneNumberId}/register`, { method: "POST", headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }) });
        console.log("[whatsapp-connect] Register:", await r.json());
      } catch (e: unknown) { console.error("[whatsapp-connect] Register error:", e instanceof Error ? e.message : e); }
    }

    // ══════════════════════════════════════════════════════
    // STEP 5: Save connection
    // ══════════════════════════════════════════════════════
    if (!resolvedPhoneNumberId) {
      console.error("[whatsapp-connect] ❌ No phone number ID after all attempts");
      try { await supabase.from("whatsapp_logs").insert({ event_type: "no_phone", user_id: userId, payload: { resolvedWabaId }, error_message: "No phone ID" }); } catch (_) {}
      return respondError("Não foi possível identificar o Phone Number ID.", { resolvedWabaId });
    }

    console.log("[whatsapp-connect] LOG connection-save-start", { userId, phoneNumberId: resolvedPhoneNumberId, wabaId: resolvedWabaId, phoneNumber, displayName });

    const { data: savedConn, error: saveError } = await supabase
      .from("whatsapp_connections")
      .upsert({
        user_id: userId,
        provider: "meta_whatsapp",
        phone_number_id: resolvedPhoneNumberId,
        business_account_id: resolvedWabaId || null,
        phone_number: phoneNumber || null,
        display_name: displayName || null,
        access_token_encrypted: accessToken,
        status: "connected",
        metadata: { connected_via: isFromOAuthCallback ? "manual_oauth_callback" : "manual_oauth_post", connected_at: new Date().toISOString() },
      }, { onConflict: "user_id,phone_number_id" })
      .select("id, phone_number_id, phone_number, display_name, business_account_id, status, webhook_verify_token, created_at")
      .single();

    if (saveError) {
      console.error("[whatsapp-connect] LOG connection-save-error:", saveError.message, saveError.details);
      return respondError("Erro ao salvar conexão: " + saveError.message);
    }

    console.log("[whatsapp-connect] LOG connection-save-success:", savedConn?.id);

    try {
      await supabase.from("whatsapp_logs").insert({ event_type: "signup_success", user_id: userId, payload: { id: savedConn?.id, waba: resolvedWabaId, phone: resolvedPhoneNumberId } });
    } catch (_) {}

    return respondSuccess({ connection: savedConn });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp-connect] ❌ UNHANDLED:", msg, error instanceof Error ? error.stack : "");
    return jsonOk({ success: false, error: msg, _unhandled: true });
  }
});
