// Cliente Abstrato de IA (Lovable Gateway e OpenAI)
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
  const provider = Deno.env.get("AI_PROVIDER") || "lovable"; // 'lovable' ou 'openai'

  if (provider === "openai") {
    return chatCompletionOpenAI(opts);
  }

  return chatCompletionLovable(opts);
}

async function chatCompletionLovable(opts: {
  messages: ChatMessage[];
  tools?: any[];
  model?: string;
  temperature?: number;
}) {
  const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("configuration_error: LOVABLE_API_KEY não configurada.");

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

  if (res.status === 429) throw new Error("rate_limited: muitas requisições ao modelo.");
  if (res.status === 402) throw new Error("credits_exhausted: créditos de IA esgotados.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ai_gateway_error(${res.status}): ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message ?? { role: "assistant", content: "" };
}

async function chatCompletionOpenAI(opts: {
  messages: ChatMessage[];
  tools?: any[];
  model?: string;
  temperature?: number;
}) {
  const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("configuration_error: OPENAI_API_KEY não configurada no provedor.");

  const modelOverride = opts.model?.includes("gpt") ? opts.model : "gpt-4o";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelOverride,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    }),
  });

  if (res.status === 429) throw new Error("rate_limited: limite da API da OpenAI atingido.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openai_error(${res.status}): ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  // We should theoretically log usage here (data.usage.total_tokens)
  return data?.choices?.[0]?.message ?? { role: "assistant", content: "" };
}
