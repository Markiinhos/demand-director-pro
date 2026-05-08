import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getMetaConfigStatus() {
  const metaAppId = Deno.env.get("META_APP_ID") || Deno.env.get("VITE_META_APP_ID") || "";
  const metaConfigId = Deno.env.get("VITE_META_CONFIG_ID") || Deno.env.get("META_CONFIG_ID") || "";
  const metaAppSecret = Deno.env.get("META_APP_SECRET") || "";

  return {
    hasMetaAppId: Boolean(metaAppId),
    hasMetaAppSecret: Boolean(metaAppSecret),
    hasMetaConfigId: Boolean(metaConfigId),
    ready: Boolean(metaAppId && metaAppSecret && metaConfigId),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (url.pathname.endsWith("/config-status")) {
    return new Response(JSON.stringify(getMetaConfigStatus()), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET - Webhook verification (Meta sends this during setup)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !token) {
      return new Response("Forbidden", { status: 403 });
    }

    // MULTI-TENANT: Look up which user has this verify token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("id")
      .eq("webhook_verify_token", token)
      .limit(1)
      .maybeSingle();

    // Also check global fallback token
    const globalToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (conn || token === globalToken) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // POST - Incoming events from Meta
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Log raw webhook payload
      await supabase.from("whatsapp_logs").insert({
        event_type: "webhook_received",
        payload,
      });

      // Process entries
      const entries = payload?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Get phone_number_id from the webhook metadata
          const phoneNumberId = value?.metadata?.phone_number_id;

          // MULTI-TENANT: Find which user owns this phone_number_id
          let connectionUserId: string | null = null;
          let connectionId: string | null = null;

          if (phoneNumberId) {
            const { data: conn } = await supabase
              .from("whatsapp_connections")
              .select("id, user_id")
              .eq("phone_number_id", phoneNumberId)
              .eq("status", "connected")
              .limit(1)
              .maybeSingle();

            if (conn) {
              connectionUserId = conn.user_id;
              connectionId = conn.id;
            }
          }

          // Process status updates
          const statuses = value?.statuses || [];
          for (const status of statuses) {
            const waMessageId = status.id;
            const newStatus = status.status; // sent, delivered, read, failed

            if (waMessageId && newStatus) {
              await supabase.from("whatsapp_messages").update({
                status: newStatus === "failed" ? "failed" : newStatus,
                error_message: status?.errors?.[0]?.title || null,
              }).eq("wa_message_id", waMessageId);
            }
          }

          // Process incoming messages
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];
          for (const message of messages) {
            const from = message.from;
            const text = message.text?.body || message.caption || "";
            const contactName = contacts?.[0]?.profile?.name || from;

            // Determine message type and media
            const msgType = message.type || "text";
            let mediaUrl: string | null = null;

            if (["image", "document", "audio", "video"].includes(msgType)) {
              const mediaInfo = message[msgType];
              if (mediaInfo?.id) {
                // Store media ID for later retrieval
                mediaUrl = `wa_media:${mediaInfo.id}`;
              }
            }

            // Find client by phone (try multiple formats)
            const cleanFrom = from.replace(/\D/g, "");
            const variants = [from, `+${from}`, cleanFrom, `+${cleanFrom}`];

            let clientId: string | null = null;
            let userId: string | null = connectionUserId;

            for (const variant of variants) {
              const { data: clientMatches } = await supabase
                .from("clients")
                .select("id, user_id")
                .eq("phone", variant)
                .limit(1);

              if (clientMatches && clientMatches.length > 0) {
                const client = clientMatches[0];
                clientId = client.id;
                // If we found the client's owner, use it (if no connection match)
                if (!userId) userId = client.user_id;
                break;
              }
            }

            if (clientId && userId) {
              await supabase.from("whatsapp_messages").insert({
                user_id: userId,
                client_id: clientId,
                whatsapp_connection_id: connectionId,
                direction: "inbound",
                message_type: msgType,
                wa_message_id: message.id,
                content: text || `[${msgType}]`,
                media_url: mediaUrl,
                status: "received",
                metadata: {
                  contact_name: contactName,
                  timestamp: message.timestamp,
                },
              });

              // Create notification for inbound message
              await supabase.from("notifications").insert({
                user_id: userId,
                title: "Nova mensagem WhatsApp 💬",
                message: `${contactName}: ${text.substring(0, 100) || `[${msgType}]`}`,
                type: "info",
                link: "/whatsapp",
                related_entity_type: "whatsapp_message",
                related_entity_id: clientId,
              });
            } else {
              // Log unmatched incoming message
              await supabase.from("whatsapp_logs").insert({
                event_type: "unmatched_inbound",
                user_id: connectionUserId,
                payload: {
                  from,
                  text,
                  message_id: message.id,
                  phone_number_id: phoneNumberId,
                },
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("OK", { status: 200 }); // Always return 200 to Meta
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
