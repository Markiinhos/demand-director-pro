import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(val?: string | null): string {
  return (val || "").replace(/\D/g, "");
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

    const { client_id } = await req.json();
    if (!client_id) throw new Error("ID do cliente não informado");

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Asaas connection
    const { data: conn, error: connErr } = await serviceClient
      .from("asaas_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn || conn.status !== "connected") {
      throw new Error("Integração com Asaas não configurada ou inativa.");
    }

    // Fetch client
    const { data: client, error: clientErr } = await serviceClient
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .eq("user_id", user.id)
      .single();

    if (clientErr || !client) throw new Error("Cliente não encontrado");

    const baseUrl = conn.environment === "production"
      ? "https://api.asaas.com"
      : "https://sandbox.asaas.com";
    const apiKey = conn.api_key_encrypted;

    const docDigits = onlyDigits(client.cpf || client.cnpj);
    const phoneDigits = onlyDigits(client.phone || client.whatsapp);

    const customerPayload: Record<string, any> = {
      name: client.name || client.full_name || client.trade_name || "Cliente Sem Nome",
      email: client.email || undefined,
      phone: phoneDigits ? phoneDigits.slice(0, 11) : undefined,
      mobilePhone: phoneDigits ? phoneDigits.slice(0, 11) : undefined,
      cpfCnpj: docDigits || undefined,
      postalCode: onlyDigits(client.zip_code) || undefined,
      address: client.street || undefined,
      addressNumber: client.address_number || undefined,
      complement: client.complement || undefined,
      province: client.neighborhood || undefined,
      externalReference: client.id,
      notificationDisabled: false,
    };

    let asaasCustomerId = client.asaas_customer_id;

    // Search by doc if no customer ID stored yet
    if (!asaasCustomerId && docDigits) {
      const searchRes = await fetch(`${baseUrl}/api/v3/customers?cpfCnpj=${docDigits}`, {
        headers: { access_token: apiKey },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          asaasCustomerId = searchData.data[0].id;
        }
      }
    }

    if (asaasCustomerId) {
      // Update existing customer in Asaas
      const updateRes = await fetch(`${baseUrl}/api/v3/customers/${asaasCustomerId}`, {
        method: "PUT",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerPayload),
      });

      if (!updateRes.ok) {
        const errJson = await updateRes.json().catch(() => ({}));
        console.error("Error updating Asaas customer:", errJson);
        throw new Error(`Erro ao atualizar cliente no Asaas: ${errJson.errors?.[0]?.description || updateRes.statusText}`);
      }
    } else {
      // Create new customer in Asaas
      const createRes = await fetch(`${baseUrl}/api/v3/customers`, {
        method: "POST",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerPayload),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        console.error("Error creating Asaas customer:", errJson);
        throw new Error(`Erro ao criar cliente no Asaas: ${errJson.errors?.[0]?.description || createRes.statusText}`);
      }

      const createdCustomer = await createRes.json();
      asaasCustomerId = createdCustomer.id;
    }

    // Update client record in DB
    const { error: updateDbErr } = await serviceClient
      .from("clients")
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_sync_status: "synced",
        asaas_synced_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (updateDbErr) throw updateDbErr;

    return new Response(
      JSON.stringify({
        success: true,
        asaas_customer_id: asaasCustomerId,
        message: "Cliente sincronizado com sucesso no Asaas!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
