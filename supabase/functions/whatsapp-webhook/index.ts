import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET - Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST - Incoming events
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

            // Find client by phone
            const { data: clientMatches } = await supabase
              .from("clients")
              .select("id, user_id")
              .or(`phone.eq.${from},phone.eq.+${from}`)
              .limit(1);

            if (clientMatches && clientMatches.length > 0) {
              const client = clientMatches[0];
              await supabase.from("whatsapp_messages").insert({
                user_id: client.user_id,
                client_id: client.id,
                direction: "inbound",
                message_type: message.type || "text",
                wa_message_id: message.id,
                content: text,
                status: "received",
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
