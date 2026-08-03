// =====================================================================
// ABSTRAÇÃO DE PROVEDOR DE WHATSAPP (Meta Cloud API | UAZAPI)
// =====================================================================
const META_API_URL = "https://graph.facebook.com/v23.0";

export type WhatsAppSendInput = {
  to: string;
  content: string;
  client_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  metadata?: Record<string, unknown>;
  conversation_id?: string | null;
};

export type ProviderResult = {
  provider: string;
  wa_message_id: string | null;
  raw?: unknown;
};

export interface WhatsAppProvider {
  readonly name: string;
  sendText(to: string, body: string): Promise<ProviderResult>;
}

export const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

// ------------------------------ Meta ---------------------------------
class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta";
  constructor(private phoneNumberId: string, private accessToken: string) {}

  async sendText(to: string, body: string): Promise<ProviderResult> {
    const res = await fetch(`${META_API_URL}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      let msg = data?.error?.message || "Erro na API do WhatsApp";
      if (code === 131030) msg = "Número do destinatário não autorizado (conta em modo de testes na Meta).";
      if (code === 190 || code === 200) msg = "Access Token inválido ou expirado. Reconecte o WhatsApp em Integrações.";
      throw new Error(msg);
    }
    return { provider: this.name, wa_message_id: data?.messages?.[0]?.id ?? null, raw: data };
  }
}

// ----------------------------- UAZAPI --------------------------------
class UazapiProvider implements WhatsAppProvider {
  readonly name = "uazapi";
  constructor(private baseUrl: string, private token: string) {}

  async sendText(to: string, body: string): Promise<ProviderResult> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/send/text`;
    const res = await fetch(url, {
      method: "POST",
      headers: { token: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({ number: normalizePhone(to), text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || "Erro na API UAZAPI");
    return { provider: this.name, wa_message_id: data?.id || data?.messageid || data?.key?.id || null, raw: data };
  }
}

// --------------------------- Resolução --------------------------------
export async function resolveProvider(
  supabase: any,
  user_id: string,
): Promise<{ provider: WhatsAppProvider; connection: any }> {
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", user_id)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) throw new Error("Nenhuma conexão de WhatsApp ativa. Configure em Integrações > WhatsApp.");

  const kind = (connection.provider || "meta").toLowerCase();

  if (kind === "uazapi") {
    const baseUrl = connection.metadata?.instance_url || Deno.env.get("UAZAPI_BASE_URL") || "";
    const token = connection.access_token_encrypted || Deno.env.get("UAZAPI_TOKEN") || "";
    if (!baseUrl || !token) throw new Error("Conexão UAZAPI incompleta (URL da instância ou token ausente).");
    return { provider: new UazapiProvider(baseUrl, token), connection };
  }

  if (!connection.phone_number_id || !connection.access_token_encrypted) {
    throw new Error("Conexão Meta incompleta. Reconecte o WhatsApp Business.");
  }
  return {
    provider: new MetaCloudProvider(connection.phone_number_id, connection.access_token_encrypted),
    connection,
  };
}

/** Envia e registra a mensagem em whatsapp_messages (com tratamento de falha). */
export async function sendWhatsApp(supabase: any, user_id: string, input: WhatsAppSendInput) {
  const { data: row, error: insertError } = await supabase.from("whatsapp_messages").insert([{
    user_id,
    client_id: input.client_id ?? null,
    direction: "outbound",
    message_type: "text",
    content: input.content,
    status: "queued",
    related_entity_type: input.related_entity_type ?? null,
    related_entity_id: input.related_entity_id ?? null,
    metadata: { ...(input.metadata ?? {}), to: input.to },
  }]).select().single();
  if (insertError) throw insertError;

  try {
    const { provider, connection } = await resolveProvider(supabase, user_id);
    const result = await provider.sendText(input.to, input.content);
    await supabase.from("whatsapp_messages").update({
      status: "sent",
      wa_message_id: result.wa_message_id,
      whatsapp_connection_id: connection.id,
    }).eq("id", row.id);
    return { message_id: row.id, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("whatsapp_messages").update({ status: "failed", error_message: message }).eq("id", row.id);
    throw new Error(message);
  }
}
