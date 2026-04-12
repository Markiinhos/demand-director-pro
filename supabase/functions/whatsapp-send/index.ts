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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { messageId, phone, content, messageType, templateName } = await req.json();

    if (!messageId || !phone || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!accessToken || !phoneNumberId) {
      // Update message status
      await supabase.from("whatsapp_messages").update({
        status: "failed",
        error_message: "WhatsApp API não configurada. Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.",
      }).eq("id", messageId);

      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), { status: 503, headers: corsHeaders });
    }

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

      return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: corsHeaders });
    }

    // Update message with WhatsApp message ID
    const waMessageId = waData?.messages?.[0]?.id;
    await supabase.from("whatsapp_messages").update({
      status: "sent",
      wa_message_id: waMessageId,
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
