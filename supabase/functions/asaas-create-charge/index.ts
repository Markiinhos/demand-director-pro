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
    const {
      client_id,
      amount,
      billing_type, // 'PIX' | 'BOLETO' | 'CREDIT_CARD'
      due_date,
      description = "",
      demand_id = null,
      financial_entry_id = null,
    } = body;

    if (!client_id || !amount || !billing_type || !due_date) {
      throw new Error("Parâmetros obrigatórios ausentes (client_id, amount, billing_type, due_date)");
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get Asaas connection
    const { data: conn, error: connErr } = await serviceClient
      .from("asaas_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn || conn.status !== "connected") {
      throw new Error("Integração com Asaas não configurada.");
    }

    // Get client details
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

    // Ensure customer is synced to Asaas
    let asaasCustomerId = client.asaas_customer_id;
    if (!asaasCustomerId) {
      // Call sync-customer logic internally or create inline
      const docDigits = (client.cpf || client.cnpj || "").replace(/\D/g, "");
      const phoneDigits = (client.phone || client.whatsapp || "").replace(/\D/g, "");

      const createCustRes = await fetch(`${baseUrl}/api/v3/customers`, {
        method: "POST",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: client.name,
          email: client.email || undefined,
          phone: phoneDigits ? phoneDigits.slice(0, 11) : undefined,
          cpfCnpj: docDigits || undefined,
          externalReference: client.id,
        }),
      });

      if (!createCustRes.ok) {
        const errData = await createCustRes.json().catch(() => ({}));
        throw new Error(`Erro ao cadastrar cliente no Asaas: ${errData.errors?.[0]?.description || "Falha na requisição"}`);
      }

      const custData = await createCustRes.json();
      asaasCustomerId = custData.id;

      await serviceClient
        .from("clients")
        .update({
          asaas_customer_id: asaasCustomerId,
          asaas_sync_status: "synced",
          asaas_synced_at: new Date().toISOString(),
        })
        .eq("id", client.id);
    }

    // Create payment in Asaas
    const paymentPayload: Record<string, any> = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value: Number(amount),
      dueDate: due_date,
      description: description || `Cobrança - ${client.name}`,
      externalReference: financial_entry_id || demand_id || client_id,
    };

    const paymentRes = await fetch(`${baseUrl}/api/v3/payments`, {
      method: "POST",
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!paymentRes.ok) {
      const errData = await paymentRes.json().catch(() => ({}));
      throw new Error(`Erro ao gerar cobrança no Asaas: ${errData.errors?.[0]?.description || paymentRes.statusText}`);
    }

    const paymentData = await paymentRes.json();

    let pixQrCode = null;
    let pixPayload = null;

    // If PIX, fetch QR Code
    if (billing_type === "PIX") {
      const pixRes = await fetch(`${baseUrl}/api/v3/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: apiKey },
      });
      if (pixRes.ok) {
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage || null;
        pixPayload = pixData.payload || null;
      }
    }

    // Save charge to asaas_charges table
    const { data: savedCharge, error: chargeSaveErr } = await serviceClient
      .from("asaas_charges")
      .insert({
        user_id: user.id,
        client_id: client.id,
        demand_id: demand_id,
        financial_entry_id: financial_entry_id,
        asaas_payment_id: paymentData.id,
        status: paymentData.status || "PENDING",
        billing_type: billing_type,
        amount: Number(amount),
        due_date: due_date,
        description: description,
        invoice_url: paymentData.invoiceUrl || paymentData.bankSlipUrl || null,
        bank_slip_url: paymentData.bankSlipUrl || null,
        pix_payload: pixPayload,
        pix_qr_code: pixQrCode,
        external_reference: paymentData.externalReference || null,
        metadata: paymentData,
      })
      .select()
      .single();

    if (chargeSaveErr) throw chargeSaveErr;

    return new Response(
      JSON.stringify({
        success: true,
        charge: savedCharge,
        payment_id: paymentData.id,
        invoice_url: paymentData.invoiceUrl || paymentData.bankSlipUrl,
        bank_slip_url: paymentData.bankSlipUrl,
        pix_qr_code: pixQrCode,
        pix_payload: pixPayload,
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
