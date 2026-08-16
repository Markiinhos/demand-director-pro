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

    const body = await req.json();
    const { action = "connect", apiKey, environment = "sandbox" } = body;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "disconnect") {
      await serviceClient
        .from("asaas_connections")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true, message: "Desconectado com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      const { data: conn } = await serviceClient
        .from("asaas_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!conn || !conn.api_key_encrypted || conn.status !== "connected") {
        throw new Error("Nenhuma integração Asaas ativa encontrada.");
      }

      const baseUrl = conn.environment === "production"
        ? "https://api.asaas.com"
        : "https://sandbox.asaas.com";

      const res = await fetch(`${baseUrl}/api/v3/finance/balance`, {
        headers: { access_token: conn.api_key_encrypted },
      });

      if (!res.ok) {
        await serviceClient
          .from("asaas_connections")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("user_id", user.id);

        throw new Error("Chave de API do Asaas inválida ou expirada.");
      }

      const balanceData = await res.json();
      return new Response(
        JSON.stringify({ success: true, balance: balanceData.balance, status: "connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "connect") {
      if (!apiKey || typeof apiKey !== "string") {
        throw new Error("Informe a API Key do Asaas.");
      }

      const cleanApiKey = apiKey.trim();
      const baseUrl = environment === "production"
        ? "https://api.asaas.com"
        : "https://sandbox.asaas.com";

      // Test key first with Asaas API
      const testRes = await fetch(`${baseUrl}/api/v3/finance/balance`, {
        headers: { access_token: cleanApiKey },
      });

      if (!testRes.ok) {
        const errText = await testRes.text();
        console.error("Asaas connection test failed:", errText);
        throw new Error("Não foi possível autenticar no Asaas. Verifique a API Key e o ambiente.");
      }

      const balanceData = await testRes.json();

      // Upsert into asaas_connections
      const { data: savedConn, error: saveErr } = await serviceClient
        .from("asaas_connections")
        .upsert(
          {
            user_id: user.id,
            environment: environment,
            api_key_encrypted: cleanApiKey,
            status: "connected",
            metadata: { last_balance: balanceData.balance, connected_at: new Date().toISOString() },
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
          message: "Asaas conectado com sucesso!",
          connection: {
            id: savedConn.id,
            environment: savedConn.environment,
            status: savedConn.status,
            balance: balanceData.balance,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação '${action}' desconhecida.`);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
