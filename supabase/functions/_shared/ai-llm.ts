// Cliente do Lovable AI Gateway (function calling, OpenAI-compatible)
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3.6-flash";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export async function chatCompletion(opts: {
  messages: ChatMessage[];
  tools?: any[];
  model?: string;
  temperature?: number;
}) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    }),
  });

  if (res.status === 429) throw new Error("rate_limited: muitas requisições ao modelo. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("credits_exhausted: créditos de IA esgotados no workspace.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ai_gateway_error(${res.status}): ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message ?? { role: "assistant", content: "" };
}
