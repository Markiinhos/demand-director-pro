import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Service role client for privileged operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { messageId, phone, content, messageType, templateName, mediaUrl } = await req.json();

    if (!messageId || !phone || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    // MULTI-TENANT: Get user's WhatsApp connection
    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("id, phone_number_id, access_token_encrypted, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError || !connection) {
      await supabase.from("whatsapp_messages").update({
        status: "failed",
        error_message: "Nenhuma conexão WhatsApp ativa. Vá em Integrações > WhatsApp para configurar.",
      }).eq("id", messageId);

      return new Response(JSON.stringify({ error: "No WhatsApp connection found" }), { status: 503, headers: corsHeaders });
    }

    const accessToken = connection.access_token_encrypted;
    const phoneNumberId = connection.phone_number_id;

    // Format phone
    const formattedPhone = phone.replace(/\D/g, "");

    let waPayload: Record<string, unknown>;

    if (messageType === "template" && templateName) {
      waPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: { name: templateName, language: { code: "pt_BR" } },
      };
    } else if (messageType === "document" && mediaUrl) {
      waPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "document",
        document: {
          link: mediaUrl,
          caption: content,
          filename: mediaUrl.split("/").pop() || "documento.pdf",
        },
      };
    } else if (messageType === "image" && mediaUrl) {
      waPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "image",
        image: { link: mediaUrl, caption: content },
      };
    } else {
      waPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: content },
      };
    }

    const waResponse = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(waPayload),
    });

    const waData = await waResponse.json();

    if (!waResponse.ok) {
      const errorMsg = waData?.error?.message || "WhatsApp API error";
      await supabase.from("whatsapp_messages").update({
        status: "failed",
        error_message: errorMsg,
      }).eq("id", messageId);

      // If token error, mark connection as error
      if (waResponse.status === 401 || waResponse.status === 403) {
        await supabase.from("whatsapp_connections").update({
          status: "error",
          metadata: { last_error: errorMsg, error_at: new Date().toISOString() },
        }).eq("id", connection.id);
      }

      return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: corsHeaders });
    }

    // Update message with WhatsApp message ID
    const waMessageId = waData?.messages?.[0]?.id;
    await supabase.from("whatsapp_messages").update({
      status: "sent",
      wa_message_id: waMessageId,
      whatsapp_connection_id: connection.id,
    }).eq("id", messageId);

    return new Response(JSON.stringify({ success: true, wa_message_id: waMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
