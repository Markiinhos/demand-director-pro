import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET - Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("id")
        .eq("webhook_verify_token", token)
        .limit(1)
        .maybeSingle();

      const globalToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
      if (conn || token === globalToken) {
        return new Response(challenge, { status: 200 });
      }
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST - Incoming events
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      
      await supabase.from("whatsapp_logs").insert({
        event_type: "webhook_received",
        payload,
      });

      let normalizedMessages: any[] = [];
      let provider = "unknown";

      // 1. Meta API
      if (payload.object === "whatsapp_business_account" && payload.entry) {
        provider = "meta";
        for (const entry of payload.entry) {
          for (const change of entry.changes || []) {
            const value = change.value;
            if (!value) continue;

            const phoneId = value.metadata?.phone_number_id;
            const messages = value.messages || [];
            const contacts = value.contacts || [];

            for (const msg of messages) {
              const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
              normalizedMessages.push({
                provider_message_id: msg.id,
                connection_phone_id: phoneId,
                from_phone: msg.from,
                text,
                contact_name: contacts[0]?.profile?.name || msg.from,
                type: msg.type || "text",
                timestamp: msg.timestamp,
              });
            }

            // Tratamento de status para evitar falhas ao rodar as messages
            const statuses = value.statuses || [];
            for (const status of statuses) {
               if (status.id && status.status) {
                 await supabase.from("whatsapp_messages").update({
                   status: status.status === "failed" ? "failed" : status.status,
                   error_message: status.errors?.[0]?.title || null,
                 }).eq("wa_message_id", status.id);
               }
            }
          }
        }
      }
      // 2. UAZAPI / Evolution API (suporte via event 'messages.upsert')
      else if (payload.event === "messages.upsert" && payload.data) {
        provider = "uazapi";
        const instanceStr = payload.instance || "default"; // pode ser usado como connection_phone_id
        
        // As vezes uazapi.data é um array, dependendo da versão
        const dataArr = Array.isArray(payload.data) ? payload.data : [payload.data];
        
        for (const msg of dataArr) {
          if (msg.key?.fromMe) continue; // ignorar nossas proprias mensagens
          
          let text = "";
          if (msg.message?.conversation) text = msg.message.conversation;
          else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
          
          normalizedMessages.push({
            provider_message_id: msg.key?.id,
            connection_phone_id: instanceStr,
            from_phone: msg.key?.remoteJid?.split("@")[0],
            text,
            contact_name: msg.pushName || msg.key?.remoteJid?.split("@")[0],
            type: "text",
            timestamp: msg.messageTimestamp,
          });
        }
      }

      // Process normalized messages
      for (const msg of normalizedMessages) {
        if (!msg.text || !msg.from_phone) continue;

        // Dedup por provider_message_id
        if (msg.provider_message_id) {
           const { data: existingMsg } = await supabase.from("whatsapp_messages")
              .select("id").eq("provider_message_id", msg.provider_message_id).maybeSingle();
           if (existingMsg) {
             console.log("Duplicate message ignored:", msg.provider_message_id);
             continue;
           }
        }

        let connectionUserId: string | null = null;
        let connectionId: string | null = null;

        if (msg.connection_phone_id) {
           // Procura connection
           const { data: conn } = await supabase.from("whatsapp_connections")
              .select("id, user_id, provider")
              .or(`phone_number_id.eq.${msg.connection_phone_id},instance_name.eq.${msg.connection_phone_id}`)
              .limit(1).maybeSingle();
           if (conn) {
              connectionUserId = conn.user_id;
              connectionId = conn.id;
           }
        }

        const cleanFrom = msg.from_phone.replace(/\D/g, "");
        const variants = [msg.from_phone, `+${msg.from_phone}`, cleanFrom, `+${cleanFrom}`];

        let clientId: string | null = null;
        let userId: string | null = connectionUserId;

        // Se encontrou user via conexão, procure o cliente neste user
        if (userId) {
           const { data: clientMatches } = await supabase.from("clients")
              .select("id")
              .eq("user_id", userId)
              .in("phone", variants)
              .limit(1);
           if (clientMatches && clientMatches.length > 0) {
              clientId = clientMatches[0].id;
           }
        } else {
           // Se não achou conexão mapeada, procure o user via cliente
           for (const variant of variants) {
             const { data: clientMatches } = await supabase.from("clients")
                .select("id, user_id")
                .eq("phone", variant)
                .limit(1);
             if (clientMatches && clientMatches.length > 0) {
                clientId = clientMatches[0].id;
                userId = clientMatches[0].user_id;
                break;
             }
           }
        }

        if (userId) {
          // Criar conversa se não existir? agent já faz isso. Apenas inserimos a msg.
          const { error } = await supabase.from("whatsapp_messages").insert({
            user_id: userId,
            client_id: clientId,
            whatsapp_connection_id: connectionId,
            direction: "inbound",
            message_type: msg.type,
            wa_message_id: msg.provider_message_id,
            provider_message_id: msg.provider_message_id,
            provider,
            content: msg.text,
            status: "received",
            metadata: {
              contact_name: msg.contact_name,
            },
          });
          
          if (!error) {
             // Notificação opcional
             await supabase.from("notifications").insert({
               user_id: userId,
               title: "Nova mensagem WhatsApp 💬",
               message: `${msg.contact_name}: ${msg.text.substring(0, 100)}`,
               type: "info",
             });

             // Chamar whatsapp-agent
             await supabase.functions.invoke("whatsapp-agent", {
               body: {
                 wa_message_id: msg.provider_message_id,
                 user_id: userId,
                 client_id: clientId,
                 connection_id: connectionId,
                 phone: msg.from_phone,
                 text: msg.text,
                 contact_name: msg.contact_name
               }
             });
          }
        } else {
           console.log("No user mapped for incoming message:", msg.from_phone);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("OK", { status: 200 }); // Always 200 to Meta
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
