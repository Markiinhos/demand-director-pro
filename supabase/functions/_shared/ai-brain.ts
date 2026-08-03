// =====================================================================
// CÉREBRO DO GESTOR OPERACIONAL — compartilhado por todos os canais
// =====================================================================
import { chatCompletion, type ChatMessage } from "./ai-llm.ts";
import { logAiEvent, timer } from "./ai-audit.ts";
import {
  buildToolCatalog,
  executeAiTool,
  getTool,
  validateToolArgs,
  type AccessRole,
  type Channel,
} from "./ai-tools.ts";

const MAX_STEPS = 5;
const HISTORY_LIMIT = 20;
const CONFIRMATION_TTL_MIN = 30;

export type AgentTurnInput = {
  supabase: any;
  user_id: string;
  message: string;
  channel: Channel;
  role?: AccessRole;
  scoped_client_id?: string | null;
  conversation_id?: string | null;
  external_identifier?: string | null;
  external_metadata?: Record<string, unknown>;
};

export type AgentTurnResult = {
  response: string;
  conversation_id: string;
  pending_actions: Array<{ id: string; tool_name: string; risk_level: string }>;
  executed_tools: string[];
};

async function idempotencyKey(user_id: string, tool: string, args: unknown) {
  const raw = `${user_id}|${tool}|${JSON.stringify(args ?? {})}|${new Date().toISOString().slice(0, 10)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveConversation(input: AgentTurnInput): Promise<string> {
  const { supabase, user_id, channel, external_identifier, conversation_id, message } = input;

  if (conversation_id) return conversation_id;

  if (external_identifier) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("user_id", user_id)
      .eq("channel", channel)
      .eq("external_identifier", external_identifier)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: created, error } = await supabase.from("ai_conversations").insert([{
    user_id,
    title: message.slice(0, 60),
    channel,
    external_identifier: external_identifier ?? null,
    metadata: input.external_metadata ?? {},
    status: "active",
  }]).select("id").single();
  if (error) throw error;
  return created.id;
}

function buildSystemPrompt(opts: {
  base: string;
  knowledge: string;
  channel: Channel;
  role: AccessRole;
}) {
  const channelRules: Record<Channel, string> = {
    internal_chat: "Canal: painel interno. Respostas podem ser detalhadas e usar listas em markdown.",
    chatgpt_action: "Canal: GPT privado via Actions. Seja objetivo e estruturado.",
    whatsapp_admin: "Canal: WhatsApp administrativo. Respostas curtas, diretas, sem markdown pesado. Use no máximo 6 linhas.",
    whatsapp_client: "Canal: WhatsApp de cliente. Seja cordial e nunca revele dados internos, financeiros ou de outros clientes.",
    automation: "Canal: rotina automática. Produza um texto pronto para leitura rápida.",
  };

  return [
    opts.base,
    "",
    "REGRAS OPERACIONAIS:",
    "- Você é o Gestor Operacional da agência. Use as ferramentas disponíveis antes de responder sobre dados reais; nunca invente números, datas ou nomes.",
    "- Precisa de client_id? Use search_clients primeiro.",
    "- Ações de risco médio ou alto NÃO são executadas na hora: elas entram na fila de aprovação. Informe isso ao usuário de forma clara.",
    "- Nunca execute ações destrutivas ou de envio sem que a solicitação do usuário seja explícita.",
    `- Papel do solicitante: ${opts.role}.`,
    `- ${channelRules[opts.channel]}`,
    "- Responda sempre em português do Brasil.",
    opts.knowledge ? `\nBASE DE CONHECIMENTO:\n${opts.knowledge}` : "",
  ].join("\n");
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const { supabase, user_id, message } = input;
  const channel = input.channel;
  const role: AccessRole = input.role ?? "owner";
  const elapsed = timer();

  const conversationId = await resolveConversation(input);

  await supabase.from("ai_messages").insert([{
    user_id, conversation_id: conversationId, role: "user", content: message,
    channel, metadata: input.external_metadata ?? {},
  }]);

  const [{ data: agentData }, { data: knowledge }, { data: history }] = await Promise.all([
    supabase.from("ai_agents").select("*").eq("user_id", user_id).eq("is_active", true).limit(1).maybeSingle(),
    supabase.from("ai_knowledge").select("title,content").eq("user_id", user_id).order("updated_at", { ascending: false }).limit(5),
    supabase.from("ai_messages").select("role,content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
  ]);

  const systemPrompt = buildSystemPrompt({
    base: agentData?.system_prompt || "Você é o Gestor Operacional de uma agência de design, focado em organizar prazos, clientes, contratos e finanças.",
    knowledge: (knowledge ?? []).map((k: any) => `[${k.title}] ${k.content}`).join("\n\n"),
    channel,
    role,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).slice().reverse()
      .filter((h: any) => ["user", "assistant"].includes(h.role) && h.content)
      .map((h: any) => ({ role: h.role, content: h.content })),
  ];

  const tools = buildToolCatalog(role);
  const pending_actions: AgentTurnResult["pending_actions"] = [];
  const executed_tools: string[] = [];
  let finalText = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await chatCompletion({ messages, tools, model: agentData?.model || undefined });
    messages.push(reply as ChatMessage);

    const calls = reply?.tool_calls ?? [];
    if (!calls.length) {
      finalText = reply?.content || "";
      break;
    }

    for (const call of calls) {
      const toolName = call.function?.name;
      let args: any = {};
      try {
        const parsed = JSON.parse(call.function?.arguments || "{}");
        args = parsed?.payload && typeof parsed.payload === "object" ? parsed.payload : parsed;
      } catch { args = {}; }

      let toolResult: unknown;
      try {
        const def = getTool(toolName);
        if (def.risk === "low") {
          toolResult = await executeAiTool(toolName, args, {
            supabase, user_id, channel, role, scoped_client_id: input.scoped_client_id ?? null,
            conversation_id: conversationId,
          });
          executed_tools.push(toolName);
          await logAiEvent(supabase, {
            user_id, event_type: "tool_executed", channel, tool_name: toolName,
            risk_level: def.risk, payload: { args }, duration_ms: elapsed(),
          });
        } else {
          const validated = validateToolArgs(toolName, args);
          const key = await idempotencyKey(user_id, toolName, validated);
          const { data: existing } = await supabase.from("ai_actions")
            .select("id,tool_name,risk_level,status").eq("user_id", user_id)
            .eq("idempotency_key", key).maybeSingle();

          if (existing && existing.status === "pending_approval") {
            toolResult = { status: "pending_approval", action_id: existing.id, note: "Já existe uma solicitação idêntica aguardando aprovação." };
            pending_actions.push({ id: existing.id, tool_name: toolName, risk_level: existing.risk_level });
          } else if (existing && existing.status === "executed") {
            toolResult = { status: "already_executed", action_id: existing.id, note: "Ação idêntica já executada hoje." };
          } else {
            const { data: action, error } = await supabase.from("ai_actions").insert([{
              user_id, conversation_id: conversationId, tool_name: toolName, arguments: validated,
              status: "pending_approval", risk_level: def.risk, requires_approval: true,
              channel, client_id: validated?.client_id ?? null, idempotency_key: key,
              confirmation_expires_at: new Date(Date.now() + CONFIRMATION_TTL_MIN * 60000).toISOString(),
            }]).select("id,risk_level").single();
            if (error) throw error;
            pending_actions.push({ id: action.id, tool_name: toolName, risk_level: action.risk_level });
            toolResult = {
              status: "pending_approval", action_id: action.id, risk_level: def.risk,
              note: `Ação registrada na fila de aprovação (expira em ${CONFIRMATION_TTL_MIN} min). Informe o usuário e peça confirmação.`,
            };
            await logAiEvent(supabase, {
              user_id, event_type: "action_pending_approval", channel, tool_name: toolName,
              risk_level: def.risk, status: "pending", payload: { action_id: action.id, args: validated },
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toolResult = { error: msg };
        await logAiEvent(supabase, {
          user_id, event_type: "tool_failed", channel, tool_name: toolName,
          status: "error", error_message: msg, payload: { args },
        });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: JSON.stringify(toolResult).slice(0, 6000),
      });
    }
  }

  if (!finalText) {
    finalText = pending_actions.length
      ? `Preparei ${pending_actions.length} ação(ões) que precisam da sua aprovação. Confira a fila de aprovações.`
      : "Não consegui concluir a resposta agora. Pode reformular?";
  }

  await supabase.from("ai_messages").insert([{
    user_id, conversation_id: conversationId, role: "assistant", content: finalText,
    channel, metadata: { pending_actions, executed_tools },
  }]);

  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  await logAiEvent(supabase, {
    user_id, event_type: "agent_turn", channel, status: "processed", duration_ms: elapsed(),
    payload: { conversation_id: conversationId, executed_tools, pending_actions: pending_actions.length },
  });

  return { response: finalText, conversation_id: conversationId, pending_actions, executed_tools };
}
