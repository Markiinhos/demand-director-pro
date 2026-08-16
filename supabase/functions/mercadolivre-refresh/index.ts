import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function refreshMlToken(serviceClient: any, connection: any) {
  const appId = connection.metadata?.app_id || Deno.env.get("MERCADOLIVRE_CLIENT_ID");
  const clientSecret = Deno.env.get("MERCADOLIVRE_CLIENT_SECRET");

  if (!appId || !clientSecret) {
    throw new Error("Credenciais do aplicativo Mercado Livre não configuradas no servidor.");
  }

  const tokenParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: connection.refresh_token_encrypted,
  });

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!res.ok) {
    await serviceClient
      .from("mercadolivre_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", connection.id);
    throw new Error("Não foi possível renovar a sessão do Mercado Livre.");
  }

  const tokenData = await res.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString();

  const { data: updated } = await serviceClient
    .from("mercadolivre_connections")
    .update({
      access_token_encrypted: tokenData.access_token,
      refresh_token_encrypted: tokenData.refresh_token || connection.refresh_token_encrypted,
      expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .select()
    .single();

  return updated.access_token_encrypted;
}

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

    const { data: conn, error: connErr } = await serviceClient
      .from("mercadolivre_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) throw new Error("Conexão com Mercado Livre não encontrada.");

    const newToken = await refreshMlToken(serviceClient, conn);

    return new Response(
      JSON.stringify({ success: true, message: "Token renovado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
