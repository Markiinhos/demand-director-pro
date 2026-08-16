import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Header de autorização ausente");

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) throw new Error("Usuário não autenticado");

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, code, redirectUri, appId, clientSecret } = body;

    // Action 1: Exchange code
    if (action === "exchangeCode" || action === "connect") {
      if (!code || !redirectUri || !appId || !clientSecret) {
        throw new Error("Parâmetros obrigatórios ausentes (code, redirectUri, appId, clientSecret)");
      }

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: appId.trim(),
        client_secret: clientSecret.trim(),
        code: code.trim(),
        redirect_uri: redirectUri.trim(),
      });

      const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      if (!tokenRes.ok) {
        const errJson = await tokenRes.json().catch(() => ({}));
        throw new Error(`Erro OAuth Mercado Livre: ${errJson.message || tokenRes.statusText}`);
      }

      const tokenData = await tokenRes.json();
      const { access_token, refresh_token, expires_in, user_id: sellerId } = tokenData;

      // Get seller info
      let nickname = null;
      const userMeRes = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (userMeRes.ok) {
        const meData = await userMeRes.json();
        nickname = meData.nickname;
      }

      const expiresAt = new Date(Date.now() + (expires_in || 21600) * 1000).toISOString();

      const { data: savedConn, error: saveErr } = await serviceClient
        .from("mercadolivre_connections")
        .upsert(
          {
            user_id: user.id,
            seller_id: String(sellerId),
            access_token_encrypted: access_token,
            refresh_token_encrypted: refresh_token,
            expires_at: expiresAt,
            nickname: nickname,
            status: "connected",
            metadata: { app_id: appId, connected_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (saveErr) throw saveErr;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Mercado Livre conectado com sucesso!",
          connection: savedConn,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Disconnect
    if (action === "disconnect") {
      await serviceClient
        .from("mercadolivre_connections")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true, message: "Mercado Livre desconectado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação '${action}' inválida.`);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
