import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";
const META_OAUTH_DIALOG = "https://www.facebook.com/v22.0/dialog/oauth";
const OAUTH_CALLBACK_URL = "https://lwabrwtqwveqrkwegikg.supabase.co/functions/v1/whatsapp-connect";
const DEFAULT_RETURN_TO = "https://demand-director-pro.lovable.app/whatsapp";
const ALLOWED_RETURN_HOSTS = new Set([
  "demand-director-pro.lovable.app",
  "id-preview--c898cc54-01d4-433a-abb1-d2b9cf213f67.lovable.app",
]);

type ConnectRequestBody = {
  action?: string;
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  redirectUri?: string;
  returnTo?: string;
};

type OAuthStatePayload = {
  userId: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

type GranularScope = {
  permission?: string;
  target_ids?: string[];
};

function getMetaConfig() {
  const metaAppId = Deno.env.get("META_APP_ID") || Deno.env.get("VITE_META_APP_ID") || "";
  const metaConfigId = Deno.env.get("VITE_META_CONFIG_ID") || Deno.env.get("META_CONFIG_ID") || "";
  const metaAppSecret = Deno.env.get("META_APP_SECRET") || "";
  const metaRedirectUri = Deno.env.get("META_REDIRECT_URI") || Deno.env.get("VITE_META_REDIRECT_URI") || "";

  return { metaAppId, metaConfigId, metaAppSecret, metaRedirectUri };
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

function getOAuthRedirectUri(metaRedirectUri: string) {
  return metaRedirectUri || OAUTH_CALLBACK_URL;
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
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

function safeReturnTo(returnTo?: string) {
  try {
    const parsed = new URL(returnTo || DEFAULT_RETURN_TO);
    if (parsed.protocol === "https:" && ALLOWED_RETURN_HOSTS.has(parsed.hostname)) {
      return parsed.toString();
    }
  } catch (_) { /* use default */ }
  return DEFAULT_RETURN_TO;
}

async function createOAuthState(userId: string, returnTo: string, secret: string) {
  const payload: OAuthStatePayload = {
    userId,
    returnTo: safeReturnTo(returnTo),
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  };
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
  if (!payload.userId || !payload.returnTo || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

/**
 * Always returns HTTP 200 so supabase.functions.invoke passes data to the client.
 * Logical errors are indicated by { success: false, error: "..." } in the body.
 */
function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    console.log("[whatsapp-connect] Incoming request:", req.method, url.pathname);
    console.log("[whatsapp-connect] Content-Type:", req.headers.get("content-type"));
    console.log("[whatsapp-connect] Auth present:", Boolean(req.headers.get("Authorization")));

    // ── Parse body (robust: read as text then JSON.parse) ────
    let requestBody: ConnectRequestBody | null = null;
    let rawBodyPreview = "(not read)";

    if (req.method !== "GET") {
      try {
        const rawBody = await req.text();
        rawBodyPreview = rawBody?.substring(0, 300) || "(empty)";
        console.log("[whatsapp-connect] Raw body:", rawBodyPreview);
        if (rawBody) {
          requestBody = JSON.parse(rawBody);
          console.log("[whatsapp-connect] Parsed body → action:", requestBody?.action, "| code present:", Boolean(requestBody?.code));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[whatsapp-connect] ❌ Body parse FAILED:", msg, "| raw preview:", rawBodyPreview);
        requestBody = null;
      }
    }

    // Also check URL query params as fallback
    const actionParam = url.searchParams.get("action");
    const codeParam = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const metaErrorParam = url.searchParams.get("error") || url.searchParams.get("error_message");
    const { metaAppId: META_APP_ID, metaConfigId: META_CONFIG_ID, metaAppSecret: META_APP_SECRET, metaRedirectUri: META_REDIRECT_URI } = getMetaConfig();
    const oauthDialogRedirectUri = getOAuthRedirectUri(META_REDIRECT_URI);
    let callbackReturnTo: string | null = null;
    let userId = "";

    const redirectToApp = (status: "connected" | "error", message?: string) => {
      const returnUrl = new URL(callbackReturnTo || DEFAULT_RETURN_TO);
      returnUrl.searchParams.set("whatsapp", status);
      if (message) returnUrl.searchParams.set("message", message.substring(0, 180));
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: returnUrl.toString() },
      });
    };

    const respondError = (error: string, details?: Record<string, unknown>) => {
      if (callbackReturnTo) return redirectToApp("error", error);
      return jsonError(error, details);
    };

    const respondSuccess = (data: unknown) => {
      if (callbackReturnTo) return redirectToApp("connected");
      return jsonSuccess(data);
    };

    // ── config-status (NO auth required) ────────────────────
    if (isConfigStatusRoute || requestBody?.action === "config-status" || actionParam === "config-status") {
      const status = metaConfigStatus();
      console.log("[whatsapp-connect] → config-status response:", JSON.stringify(status));
      return jsonOk(status);
    }

    if (req.method === "GET" && metaErrorParam) {
      console.error("[whatsapp-connect] ❌ Meta OAuth returned error:", {
        erro_bruto_meta: Object.fromEntries(url.searchParams.entries()),
        oauth_dialog_redirect_uri: oauthDialogRedirectUri,
        token_exchange_redirect_uri: oauthDialogRedirectUri,
        "code recebido": Boolean(codeParam) ? "sim" : "não",
        "state recebido": Boolean(stateParam) ? "sim" : "não",
      });
      const statePayload = await verifyOAuthState(stateParam, META_APP_SECRET).catch(() => null);
      callbackReturnTo = statePayload?.returnTo || DEFAULT_RETURN_TO;
      return redirectToApp("error", metaErrorParam);
    }

    if (req.method === "GET" && codeParam) {
      console.log("[whatsapp-connect] OAuth callback recebido:", {
        oauth_dialog_redirect_uri: oauthDialogRedirectUri,
        token_exchange_redirect_uri: oauthDialogRedirectUri,
        "code recebido": "sim",
        "state recebido": Boolean(stateParam) ? "sim" : "não",
      });

      const statePayload = await verifyOAuthState(stateParam, META_APP_SECRET).catch((error) => {
        console.error("[whatsapp-connect] ❌ State inválido:", error instanceof Error ? error.message : String(error));
        return null;
      });

      if (!statePayload) {
        return jsonError("State OAuth inválido ou expirado.", {
          oauth_dialog_redirect_uri: oauthDialogRedirectUri,
          token_exchange_redirect_uri: oauthDialogRedirectUri,
          codeReceived: Boolean(codeParam),
          stateReceived: Boolean(stateParam),
        });
      }

      userId = statePayload.userId;
      callbackReturnTo = statePayload.returnTo;
      requestBody = {
        code: codeParam,
        redirectUri: oauthDialogRedirectUri,
      };
    }

    // ── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");

    if (!userId && !authHeader?.startsWith("Bearer ")) {
      console.error("[whatsapp-connect] ❌ No valid auth header. Has header:", Boolean(authHeader));
      return jsonError("Unauthorized - token não fornecido", { _authMissing: true });
    }

    if (!userId) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        console.error("[whatsapp-connect] ❌ Auth failed:", authError?.message);
        return jsonError("Unauthorized - usuário não autenticado", {
          _authError: authError?.message || "user is null",
        });
      }
      userId = user.id;
      console.log("[whatsapp-connect] ✅ Authenticated user:", userId);
    } else {
      console.log("[whatsapp-connect] ✅ User resolved from signed OAuth state:", userId);
    }

    // ── public-config (auth required) ───────────────────
    if (requestBody?.action === "public-config" || actionParam === "public-config") {
      if (!META_APP_ID || !META_CONFIG_ID) {
        console.error("[whatsapp-connect] ❌ Missing Meta public config:", {
          hasMetaAppId: Boolean(META_APP_ID),
          hasMetaConfigId: Boolean(META_CONFIG_ID),
        });
        return jsonError("Configuração pública da Meta indisponível.", {
          hasMetaAppId: Boolean(META_APP_ID),
          hasMetaConfigId: Boolean(META_CONFIG_ID),
        });
      }
      console.log("[whatsapp-connect] → public-config: appId present, configId present");
      return jsonOk({ appId: META_APP_ID, configId: META_CONFIG_ID });
    }

    if (!META_APP_ID || !META_APP_SECRET || !META_CONFIG_ID) {
      console.error("[whatsapp-connect] ❌ Missing required Meta backend config:", metaConfigStatus());
      return jsonError(
        "META_APP_ID, META_APP_SECRET e VITE_META_CONFIG_ID precisam estar configurados no servidor.",
        metaConfigStatus()
      );
    }

    // ── Build explicit Meta OAuth URL (auth required) ─────
    if (requestBody?.action === "oauth-url" || actionParam === "oauth-url") {
      const state = await createOAuthState(userId, requestBody?.returnTo || DEFAULT_RETURN_TO, META_APP_SECRET);
      const oauthUrl = new URL(META_OAUTH_DIALOG);
      oauthUrl.searchParams.set("client_id", META_APP_ID);
      oauthUrl.searchParams.set("redirect_uri", oauthDialogRedirectUri);
      oauthUrl.searchParams.set("config_id", META_CONFIG_ID);
      oauthUrl.searchParams.set("response_type", "code");
      oauthUrl.searchParams.set("override_default_response_type", "true");
      oauthUrl.searchParams.set("state", state);

      console.log("[whatsapp-connect] OAuth URL gerada:", {
        oauth_dialog_redirect_uri: oauthDialogRedirectUri,
        token_exchange_redirect_uri: oauthDialogRedirectUri,
        code_recebido: "não",
        state_recebido: "não",
        appIdPresent: Boolean(META_APP_ID),
        configIdPresent: Boolean(META_CONFIG_ID),
        returnTo: safeReturnTo(requestBody?.returnTo),
      });

      return jsonOk({ oauthUrl: oauthUrl.toString(), redirectUri: oauthDialogRedirectUri });
    }

    console.log("[whatsapp-connect] Meta config OK. Processing connect request...");

    // ── Service role client ──────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { code, wabaId, phoneNumberId } = requestBody || {};

    if (!code) {
      console.error("[whatsapp-connect] ❌ No code in request body. Body keys:", requestBody ? Object.keys(requestBody) : "null");
      return respondError("Código de autorização (code) ausente. Certifique-se de completar o fluxo de login do Facebook.", {
        receivedBodyKeys: requestBody ? Object.keys(requestBody) : null,
        bodyWasNull: requestBody === null,
        rawBodyPreview,
      });
    }

    // ── Step 1: Exchange code for Business Access Token ──
    // The redirect_uri MUST be identical to the one used in the OAuth dialog URL.
    const effectiveRedirectUri = oauthDialogRedirectUri;
    console.log("[whatsapp-connect] Step 1: Exchanging code for token...", {
      oauth_dialog_redirect_uri: oauthDialogRedirectUri,
      token_exchange_redirect_uri: effectiveRedirectUri,
      code_recebido: code ? "sim" : "não",
      state_recebido: stateParam ? "sim" : "não",
      codeLength: code.length,
      codePrefix: code.substring(0, 10) + "...",
      wabaId: wabaId || "(not provided)",
      phoneNumberId: phoneNumberId || "(not provided)",
      META_REDIRECT_URI_env: META_REDIRECT_URI || "(none)",
      redirectUri_sentToMeta: effectiveRedirectUri,
      META_APP_ID_used: META_APP_ID.substring(0, 6) + "...",
      META_APP_SECRET_present: Boolean(META_APP_SECRET),
    });

    const baseUrl = `${GRAPH_API}/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&code=${encodeURIComponent(code)}`;

    const strategies: { name: string; url: string }[] = [
      {
        name: `redirect_uri=${effectiveRedirectUri}`,
        url: `${baseUrl}&redirect_uri=${encodeURIComponent(effectiveRedirectUri)}`,
      },
    ];

    let tokenData: Record<string, unknown> | null = null;
    let lastError = "";

    for (const strategy of strategies) {
      console.log(`[whatsapp-connect] Trying token exchange strategy: "${strategy.name}"`);
      const tokenRes = await fetch(strategy.url);
      const data = await tokenRes.json();
      
      if (tokenRes.ok && data.access_token) {
        console.log(`[whatsapp-connect] ✅ Strategy "${strategy.name}" SUCCEEDED! Token length:`, data.access_token.length);
        tokenData = data;
        break;
      } else {
        const errMsg = data?.error?.message || "Unknown error";
        console.warn(`[whatsapp-connect] ⚠ Strategy "${strategy.name}" failed:`, {
          message: errMsg,
          fullMetaError: data?.error || data,
          redirectUriSentToMeta: effectiveRedirectUri,
        });
        lastError = errMsg;
      }
    }

    if (!tokenData?.access_token) {
      console.error("[whatsapp-connect] ❌ ALL token exchange strategies FAILED. Last error:", lastError);

      try {
        await supabase.from("whatsapp_logs").insert({
          event_type: "embedded_signup_token_error",
          user_id: user.id,
          payload: { lastError, strategiesAttempted: strategies.map(s => s.name) },
          error_message: lastError,
        });
      } catch (logErr) {
        console.error("[whatsapp-connect] Failed to log error to DB:", logErr);
      }

      return jsonError(`Token exchange falhou: ${lastError}`, {
        strategiesAttempted: strategies.map(s => s.name),
      });
    }
    console.log("[whatsapp-connect] ✅ Token exchange SUCCESS, token length:", (tokenData.access_token as string).length);

    const accessToken = tokenData.access_token;

    // ── Step 2: Get phone number details ──────────────────
    let phoneNumber = "";
    let displayName = "";
    let resolvedPhoneNumberId = phoneNumberId;
    let resolvedWabaId = wabaId;

    // If we got the waba_id but not the phone_number_id, fetch phone numbers
    if (resolvedWabaId && !resolvedPhoneNumberId) {
      console.log("[whatsapp-connect] Step 2a: Fetching phone numbers from WABA:", resolvedWabaId);
      try {
        const phonesRes = await fetch(
          `${GRAPH_API}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`
        );
        const phonesData = await phonesRes.json();
        console.log("[whatsapp-connect] Phone numbers response:", JSON.stringify(phonesData)?.substring(0, 500));
        if (phonesData?.data?.[0]) {
          resolvedPhoneNumberId = phonesData.data[0].id;
          phoneNumber = phonesData.data[0].display_phone_number || "";
          displayName = phonesData.data[0].verified_name || "";
          console.log("[whatsapp-connect] ✅ Found phone:", resolvedPhoneNumberId, phoneNumber, displayName);
        }
      } catch (e: unknown) {
        console.error("[whatsapp-connect] Phone numbers fetch error (non-critical):", e instanceof Error ? e.message : e);
      }
    }

    // If we have the phone_number_id, get its details
    if (resolvedPhoneNumberId) {
      console.log("[whatsapp-connect] Step 2b: Getting phone details for:", resolvedPhoneNumberId);
      try {
        const phoneRes = await fetch(
          `${GRAPH_API}/${resolvedPhoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status&access_token=${accessToken}`
        );
        const phoneData = await phoneRes.json();
        console.log("[whatsapp-connect] Phone details:", JSON.stringify(phoneData)?.substring(0, 300));
        if (phoneData) {
          phoneNumber = phoneData.display_phone_number || phoneNumber;
          displayName = phoneData.verified_name || displayName;
        }
      } catch (e: unknown) {
        console.error("[whatsapp-connect] Phone details fetch error (non-critical):", e instanceof Error ? e.message : e);
      }
    }

    // If we don't have the WABA ID yet, try to find it from the token's debug info
    if (!resolvedWabaId) {
      console.log("[whatsapp-connect] Step 2c: No WABA ID, trying debug_token...");
      try {
        const debugRes = await fetch(
          `${GRAPH_API}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
        );
        const debugData = await debugRes.json();
        console.log("[whatsapp-connect] debug_token response:", JSON.stringify(debugData)?.substring(0, 500));
        const granularScopes: GranularScope[] = Array.isArray(debugData?.data?.granular_scopes)
          ? debugData.data.granular_scopes
          : [];
        const waScope = granularScopes.find((s) =>
          s.permission === "whatsapp_business_management"
        );
        if (waScope?.target_ids?.[0]) {
          resolvedWabaId = waScope.target_ids[0];
          console.log("[whatsapp-connect] ✅ Found WABA ID from debug_token:", resolvedWabaId);
        }

        // Also try to find phone number ID from scopes if still missing
        if (!resolvedPhoneNumberId) {
          const msgScope = granularScopes.find((s) =>
            s.permission === "whatsapp_business_messaging"
          );
          if (msgScope?.target_ids?.[0]) {
            resolvedPhoneNumberId = msgScope.target_ids[0];
            console.log("[whatsapp-connect] ✅ Found phone number ID from debug_token:", resolvedPhoneNumberId);
          }
        }
      } catch (e: unknown) {
        console.error("[whatsapp-connect] debug_token error (non-critical):", e instanceof Error ? e.message : e);
      }
    }

    // Last resort: if we have WABA but still no phone number, try fetching
    if (resolvedWabaId && !resolvedPhoneNumberId) {
      console.log("[whatsapp-connect] Step 2d: Last resort phone number fetch from WABA:", resolvedWabaId);
      try {
        const phonesRes = await fetch(
          `${GRAPH_API}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`
        );
        const phonesData = await phonesRes.json();
        if (phonesData?.data?.[0]) {
          resolvedPhoneNumberId = phonesData.data[0].id;
          phoneNumber = phonesData.data[0].display_phone_number || phoneNumber;
          displayName = phonesData.data[0].verified_name || displayName;
          console.log("[whatsapp-connect] ✅ Found phone (last resort):", resolvedPhoneNumberId);
        }
      } catch (e: unknown) {
        console.error("[whatsapp-connect] Last resort phone fetch error:", e instanceof Error ? e.message : e);
      }
    }

    // ── Step 3: Subscribe app to WABA webhooks ──────────
    if (resolvedWabaId) {
      console.log("[whatsapp-connect] Step 3: Subscribing app to WABA webhooks:", resolvedWabaId);
      try {
        const subRes = await fetch(`${GRAPH_API}/${resolvedWabaId}/subscribed_apps`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        const subData = await subRes.json();
        console.log("[whatsapp-connect] Subscribe result:", JSON.stringify(subData));
      } catch (e: unknown) {
        console.error("[whatsapp-connect] Subscribe error (non-critical):", e instanceof Error ? e.message : e);
      }
    }

    // ── Step 4: Register phone number for Cloud API ─────
    if (resolvedPhoneNumberId) {
      console.log("[whatsapp-connect] Step 4: Registering phone for Cloud API:", resolvedPhoneNumberId);
      try {
        const regRes = await fetch(`${GRAPH_API}/${resolvedPhoneNumberId}/register`, {
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
        const regData = await regRes.json();
        console.log("[whatsapp-connect] Register result:", JSON.stringify(regData));
      } catch (e: unknown) {
        console.error("[whatsapp-connect] Register error (non-critical, may already be registered):", e instanceof Error ? e.message : e);
      }
    }

    // ── Step 5: Save connection ──────────────────────────
    if (!resolvedPhoneNumberId) {
      console.error("[whatsapp-connect] ❌ No phone number ID resolved after all attempts");
      return jsonError("Não foi possível identificar o Phone Number ID. Tente conectar novamente.", {
        resolvedWabaId: resolvedWabaId || null,
      });
    }

    console.log("[whatsapp-connect] Step 5: Saving connection...", {
      userId: user.id,
      phoneNumberId: resolvedPhoneNumberId,
      wabaId: resolvedWabaId,
      phoneNumber,
      displayName,
    });

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
      console.error("[whatsapp-connect] ❌ Save connection error:", saveError.message);
      return jsonError("Erro ao salvar conexão: " + saveError.message);
    }

    console.log("[whatsapp-connect] ✅ Connection saved successfully:", savedConn?.id);

    // Log success
    try {
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
    } catch (logErr) {
      console.error("[whatsapp-connect] Failed to log success:", logErr);
    }

    return jsonSuccess({ connection: savedConn });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("[whatsapp-connect] ❌ UNHANDLED ERROR:", errMsg, errStack);
    return jsonOk({ success: false, error: errMsg, _unhandled: true });
  }
});
