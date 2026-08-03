import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { executeAiTool } from "../_shared/ai-tools.ts";
import { logAiEvent, timer } from "../_shared/ai-audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const elapsed = timer();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", "").trim());
    if (authError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { action_id, decision } = await req.json().catch(() => ({}));
    if (!action_id) throw new Error("O campo 'action_id' é obrigatório.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rejeição explícita
    if (decision === "reject") {
      const { data, error } = await supabase.from("ai_actions")
        .update({ status: "rejected" })
        .eq("id", action_id).eq("user_id", userId).eq("status", "pending_approval")
        .select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ação não encontrada ou já processada.");
      await logAiEvent(supabase, {
        user_id: userId, event_type: "action_rejected", channel: data.channel,
        tool_name: data.tool_name, risk_level: data.risk_level, status: "rejected",
        payload: { action_id },
      });
      return new Response(JSON.stringify({ status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reserva atômica: só um executor consegue mover de pending_approval -> executing
    const { data: action, error: claimError } = await supabase.from("ai_actions")
      .update({ status: "executing", approved_at: new Date().toISOString() })
      .eq("id", action_id).eq("user_id", userId).eq("status", "pending_approval")
      .select().maybeSingle();

    if (claimError) throw claimError;
    if (!action) throw new Error("Ação não encontrada, já processada ou não pertence a esta conta.");

    if (action.confirmation_expires_at && new Date(action.confirmation_expires_at) < new Date()) {
      await supabase.from("ai_actions").update({ status: "expired" }).eq("id", action_id);
      throw new Error("Esta solicitação expirou. Peça ao agente para gerá-la novamente.");
    }

    try {
      const result = await executeAiTool(action.tool_name, action.arguments, {
        supabase,
        user_id: userId,
        channel: action.channel || "internal_chat",
        role: "owner",
        conversation_id: action.conversation_id,
      });

      await supabase.from("ai_actions").update({
        status: "executed", executed_at: new Date().toISOString(), result, error_message: null,
      }).eq("id", action_id);

      await logAiEvent(supabase, {
        user_id: userId, event_type: "action_executed", channel: action.channel,
        tool_name: action.tool_name, risk_level: action.risk_level, duration_ms: elapsed(),
        payload: { action_id, result },
      });

      return new Response(JSON.stringify({ status: "executed", result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (execError) {
      const message = execError instanceof Error ? execError.message : String(execError);
      await supabase.from("ai_actions").update({ status: "failed", error_message: message }).eq("id", action_id);
      await logAiEvent(supabase, {
        user_id: userId, event_type: "action_failed", channel: action.channel,
        tool_name: action.tool_name, risk_level: action.risk_level, status: "error",
        error_message: message, duration_ms: elapsed(), payload: { action_id },
      });
      return new Response(JSON.stringify({ status: "failed", error: message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
