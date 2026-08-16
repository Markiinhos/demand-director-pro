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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { resource, topic, user_id: sellerId } = body;

    console.log(`Webhook Mercado Livre: topic=${topic}, resource=${resource}, sellerId=${sellerId}`);

    if (topic === "orders_v2" && resource && sellerId) {
      const mlOrderId = resource.replace("/orders/", "").trim();

      // Find user connection by sellerId
      const { data: conn } = await serviceClient
        .from("mercadolivre_connections")
        .select("*")
        .eq("seller_id", String(sellerId))
        .single();

      if (conn) {
        let accessToken = conn.access_token_encrypted;

        // Fetch order details from ML
        const orderRes = await fetch(`https://api.mercadolibre.com${resource}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (orderRes.ok) {
          const order = await orderRes.json();
          const buyerName = order.buyer ? `${order.buyer.first_name || ""} ${order.buyer.last_name || ""}`.trim() || order.buyer.nickname : "Comprador ML";
          const totalAmount = Number(order.total_amount || 0);

          await serviceClient
            .from("mercadolivre_orders")
            .upsert(
              {
                user_id: conn.user_id,
                ml_order_id: String(order.id),
                ml_pack_id: order.pack_id ? String(order.pack_id) : null,
                status: order.status || "paid",
                buyer_id: order.buyer ? String(order.buyer.id) : null,
                buyer_name: buyerName,
                total_amount: totalAmount,
                currency_id: order.currency_id || "BRL",
                order_date: order.date_created || new Date().toISOString(),
                raw_payload: order,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "user_id,ml_order_id" }
            );

          // Auto-create demand
          const itemTitle = order.order_items?.[0]?.item?.title || `Pedido ML #${order.id}`;
          const { data: existingDemand } = await serviceClient
            .from("demands")
            .select("id")
            .eq("user_id", conn.user_id)
            .eq("ml_order_id", String(order.id))
            .maybeSingle();

          if (!existingDemand) {
            await serviceClient.from("demands").insert({
              user_id: conn.user_id,
              title: `ML: ${itemTitle}`,
              description: `Novo Pedido do Mercado Livre #${order.id}\nComprador: ${buyerName}\nValor: R$ ${totalAmount.toFixed(2)}`,
              status: "pendente",
              priority: "alta",
              value: totalAmount,
              ml_order_id: String(order.id),
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook ML recebido com sucesso" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro no Webhook ML:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
