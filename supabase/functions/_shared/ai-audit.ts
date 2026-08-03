// Auditoria unificada do Gestor Operacional (tabela ai_events)
export type AuditInput = {
  user_id: string | null;
  event_type: string;
  channel?: string | null;
  tool_name?: string | null;
  risk_level?: string | null;
  status?: string;
  duration_ms?: number | null;
  error_message?: string | null;
  payload?: Record<string, unknown>;
};

export async function logAiEvent(supabase: any, input: AuditInput) {
  try {
    await supabase.from("ai_events").insert([{
      user_id: input.user_id,
      event_type: input.event_type,
      channel: input.channel ?? null,
      tool_name: input.tool_name ?? null,
      risk_level: input.risk_level ?? null,
      status: input.status ?? "processed",
      duration_ms: input.duration_ms ?? null,
      error_message: input.error_message ?? null,
      payload: input.payload ?? {},
    }]);
  } catch (err) {
    console.error("[ai-audit] falha ao registrar evento", err);
  }
}

export function timer() {
  const started = Date.now();
  return () => Date.now() - started;
}
