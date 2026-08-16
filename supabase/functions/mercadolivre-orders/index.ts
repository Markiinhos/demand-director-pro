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
    const body = await req.json().catch(() => ({}));
    const { create_demands = false } = body;

    // Get Mercado Livre Connection
    const { data: conn, error: connErr } = await serviceClient
      .from("mercadolivre_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn || conn.status !== "connected") {
      throw new Error("Integração com Mercado Livre não configurada ou desconectada.");
    }

    let accessToken = conn.access_token_encrypted;
    const isExpired = new Date(conn.expires_at).getTime() < Date.now() + 60000;

    if (isExpired) {
      // Refresh token inline
      const tokenParams = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: conn.metadata?.app_id || "",
        client_secret: Deno.env.get("MERCADOLIVRE_CLIENT_SECRET") || "",
        refresh_token: conn.refresh_token_encrypted,
      });

      const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      if (refreshRes.ok) {
        const tokenData = await refreshRes.json();
        accessToken = tokenData.access_token;
        await serviceClient
          .from("mercadolivre_connections")
          .update({
            access_token_encrypted: tokenData.access_token,
            refresh_token_encrypted: tokenData.refresh_token || conn.refresh_token_encrypted,
            expires_at: new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
      }
    }

    // Search orders from seller
    const searchRes = await fetch(`https://api.mercadolibre.com/orders/search?seller=${conn.seller_id}&sort=date_desc`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const errTxt = await searchRes.text();
      console.error("ML order search failed:", errTxt);
      throw new Error(`Erro ao consultar pedidos no Mercado Livre: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    const ordersList = searchData.results || [];
    const savedOrders = [];
    const createdDemands = [];

    for (const order of ordersList) {
      const mlOrderId = String(order.id);
      const buyerName = order.buyer ? `${order.buyer.first_name || ""} ${order.buyer.last_name || ""}`.trim() || order.buyer.nickname : "Comprador ML";
      const totalAmount = Number(order.total_amount || 0);
      const orderDate = order.date_created || new Date().toISOString();

      // Upsert order in DB
      const { data: savedOrder, error: saveErr } = await serviceClient
        .from("mercadolivre_orders")
        .upsert(
          {
            user_id: user.id,
            ml_order_id: mlOrderId,
            ml_pack_id: order.pack_id ? String(order.pack_id) : null,
            status: order.status || "paid",
            buyer_id: order.buyer ? String(order.buyer.id) : null,
            buyer_name: buyerName,
            total_amount: totalAmount,
            currency_id: order.currency_id || "BRL",
            order_date: orderDate,
            raw_payload: order,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,ml_order_id" }
        )
        .select()
        .single();

      if (savedOrder) savedOrders.push(savedOrder);

      // Create demand if requested and not exists
      if (create_demands) {
        const { data: existingDemand } = await serviceClient
          .from("demands")
          .select("id")
          .eq("user_id", user.id)
          .eq("ml_order_id", mlOrderId)
          .maybeSingle();

        if (!existingDemand) {
          const itemTitle = order.order_items?.[0]?.item?.title || `Pedido ML #${mlOrderId}`;
          const { data: newDemand } = await serviceClient
            .from("demands")
            .insert({
              user_id: user.id,
              title: `ML: ${itemTitle}`,
              description: `Pedido Mercado Livre #${mlOrderId}\nComprador: ${buyerName}\nValor: R$ ${totalAmount.toFixed(2)}`,
              status: "pendente",
              priority: "alta",
              value: totalAmount,
              ml_order_id: mlOrderId,
            })
            .select()
            .single();

          if (newDemand) createdDemands.push(newDemand);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: savedOrders.length,
        orders: savedOrders,
        created_demands: createdDemands,
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
