import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event, payment } = body;

    if (!event || !payment || !payment.id) {
      return new Response(JSON.stringify({ message: "Payload ignorado (evento inválido)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = payment.id;
    console.log(`Recebido Webhook Asaas: evento=${event}, paymentId=${paymentId}`);

    // Find charge in DB by asaas_payment_id
    const { data: charge, error: chargeErr } = await serviceClient
      .from("asaas_charges")
      .select("*")
      .eq("asaas_payment_id", paymentId)
      .single();

    if (chargeErr || !charge) {
      console.warn(`Cobrança não encontrada no banco para asaas_payment_id=${paymentId}`);
      return new Response(JSON.stringify({ message: "Cobrança não encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = charge.user_id;

    // Check idempotency in asaas_webhook_events
    const { error: eventInsertErr } = await serviceClient
      .from("asaas_webhook_events")
      .insert({
        user_id: userId,
        event_type: event,
        payment_id: paymentId,
        payload: body,
      });

    if (eventInsertErr) {
      console.log(`Evento duplicado ou já processado: ${event} para payment ${paymentId}`);
      return new Response(JSON.stringify({ message: "Evento já processado (idempotente)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process event status updates
    let newStatus = charge.status;
    let paidAt = charge.paid_at;

    if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
      newStatus = "RECEIVED";
      paidAt = payment.paymentDate || new Date().toISOString();
    } else if (event === "PAYMENT_OVERDUE") {
      newStatus = "OVERDUE";
    } else if (["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(event)) {
      newStatus = "REFUNDED";
    }

    // 1. Update asaas_charges table
    await serviceClient
      .from("asaas_charges")
      .update({
        status: newStatus,
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
        metadata: { ...charge.metadata, webhook_last_event: event, last_payment_data: payment },
      })
      .eq("id", charge.id);

    // 2. Sync with financial_entries
    if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
      if (charge.financial_entry_id) {
        // Update linked financial entry as paid
        await serviceClient
          .from("financial_entries")
          .update({
            status: "pago",
            paid_at: paidAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", charge.financial_entry_id);
      } else {
        // Create new financial entry if not linked yet
        const { data: newEntry } = await serviceClient
          .from("financial_entries")
          .insert({
            user_id: userId,
            client_id: charge.client_id,
            demand_id: charge.demand_id,
            description: charge.description || `Recebimento Asaas (${payment.billingType || charge.billing_type})`,
            amount: Number(payment.value || charge.amount),
            type: "entrada",
            status: "pago",
            due_date: charge.due_date,
            paid_at: paidAt,
            payment_method: (payment.billingType || charge.billing_type).toLowerCase(),
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newEntry) {
          await serviceClient
            .from("asaas_charges")
            .update({ financial_entry_id: newEntry.id })
            .eq("id", charge.id);
        }
      }
    } else if (event === "PAYMENT_OVERDUE" && charge.financial_entry_id) {
      await serviceClient
        .from("financial_entries")
        .update({ status: "atrasado" })
        .eq("id", charge.financial_entry_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Webhook ${event} processado` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erro no Webhook Asaas:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
