import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { executeAiTool } from "../_shared/ai-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) throw new Error("Missing Authorization header.");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Invalid session.");

    const { action_id } = await req.json();
    if (!action_id) throw new Error("A field 'action_id' is required");

    // 1. Fetch action and confirm ownership + status
    const { data: action, error: fetchError } = await supabase
        .from("ai_actions")
        .select("*")
        .eq("id", action_id)
        .eq("user_id", user.id)
        .single();
    
    if (fetchError || !action) throw new Error("Ação não encontrada ou não pertence ao usuário.");
    if (action.status !== "pending_approval" && action.status !== "pending") {
        throw new Error("Ação já foi processada ou não está pendente.");
    }

    // 2. Execute real tool
    let result = null;
    let executionStatus = "executed";
    
    try {
        result = await executeAiTool(action.tool_name, action.arguments, { supabase, user_id: user.id });
    } catch (e: any) {
        executionStatus = "failed";
        result = { error: e.message };
    }

    if (executionStatus === "failed") {
        throw new Error("Falha na execução: " + JSON.stringify(result));
    }

    // 3. Update action status
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
        .from("ai_actions")
        .update({ 
            status: "executed", 
            executed_at: now,
            approved_at: now
        })
        .eq("id", action_id);
    
    if (updateError) throw updateError;

    // 4. Log event
    await supabase.from("ai_events").insert([{
        user_id: user.id,
        event_type: "action_executed_successfully",
        payload: { action_id, tool_name: action.tool_name, result },
        status: "processed"
    }]);

    return new Response(JSON.stringify({ result, status: "executed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
