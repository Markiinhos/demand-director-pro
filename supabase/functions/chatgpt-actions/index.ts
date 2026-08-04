import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { executeAiTool } from "../_shared/ai-tools.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) throw new Error("Missing Authorization header.");
    if (!authHeader.startsWith("Bearer ")) {
       throw new Error("Authorization header must start with Bearer");
    }

    const token = authHeader.substring(7).trim();
    
    // Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const keyHash = encodeHex(new Uint8Array(hashBuffer)); 

    // Create service client to bypass RLS until we find the user
    let supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration, error: intError } = await supabase
       .from("chatgpt_integrations")
       .select("user_id, is_active, revoked_at, expires_at")
       .eq("key_hash", keyHash)
       .maybeSingle();

    const url = new URL(req.url);
    const actionPath = url.pathname.split('/').pop() || "";

    // Temporarily dump sanitized diagnostics for debugging
    console.log(JSON.stringify({
       len: token.length,
       prefix_received: token.substring(0, 12),
       hash_first_12: keyHash.substring(0, 12),
       found: !!integration,
       is_active: integration?.is_active,
       revoked_presence: !!integration?.revoked_at,
       expires_at: integration?.expires_at,
       operationId: actionPath
    }));

    if (intError || !integration) {
       return new Response(JSON.stringify({ error: "integration_not_found" }), { status: 401, headers: corsHeaders });
    }
    if (!integration.is_active) {
       return new Response(JSON.stringify({ error: "integration_inactive" }), { status: 401, headers: corsHeaders });
    }
    if (integration.revoked_at) {
       return new Response(JSON.stringify({ error: "integration_revoked" }), { status: 401, headers: corsHeaders });
    }
    if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
       return new Response(JSON.stringify({ error: "integration_expired" }), { status: 401, headers: corsHeaders });
    }

    // A clean way in edge functions when we don't have JWT but have user_id, 
    // is to invoke the rest of the functions using service role, BUT explicitly filtering by user_id
    // to simulate RLS, since chatgpt-actions doesn't use standard auth.getUser().
    const userId = integration.user_id;
    
    // Update last_used
    await supabase.from("chatgpt_integrations").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId).eq("key_hash", keyHash);


    // Convert camelCase OpenAPI to snake_case tools
    const actionMap: Record<string, string> = {
        getDailyPriorities: "get_daily_priorities",
        getWeeklyPriorities: "get_weekly_priorities",
        listOverdueDemands: "list_overdue_demands",
        listUpcomingDemands: "list_upcoming_demands",
        searchClients: "search_clients",
        getClientContext: "get_client_context",
        listOverduePayments: "list_overdue_payments",
        listDueCollections: "list_due_collections",
        listExpiringContracts: "list_expiring_contracts",
        listUpcomingMeetings: "list_upcoming_meetings",
        getAgencyMetrics: "get_agency_metrics",
        listPendingActions: "list_pending_ai_actions",
        createDemand: "create_demand",
        rescheduleDemand: "reschedule_demand",
        prepareCollection: "prepare_collection",
        prepareContract: "prepare_contract",
        createMeetingAgenda: "create_meeting_agenda"
    };

    const action = actionMap[actionPath];
    if (!action) throw new Error(`Endpoint ${actionPath} not mapped to any tool.`);

    let payload = {};
    if (req.method === "POST" && req.headers.get("content-type")?.includes("json")) {
        payload = await req.json();
    }

    let result = null;
    let executionStatus = "executed";

    const lowRiskTools = [
        "get_daily_priorities", "get_weekly_priorities", "list_overdue_demands", 
        "list_upcoming_demands", "search_clients", "get_client_context", "list_overdue_payments",
        "list_due_collections", "list_expiring_contracts", "list_upcoming_meetings",
        "get_agency_metrics", "list_pending_ai_actions"
    ];
    
    if (lowRiskTools.includes(action)) {
       result = await executeAiTool(action, payload, { supabase, user_id: userId, channel: "chatgpt_action", role: "owner" });
    } else {
       const risk = (action === "prepare_collection") ? "high" : "medium";
       const { data, error } = await supabase.from("ai_actions").insert([{
           user_id: userId,
           tool_name: action,
           arguments: payload,
           status: "pending_approval",
           risk_level: risk,
           requires_approval: true
       }]).select().single();
       if (error) throw error;
       result = data;
       executionStatus = "pending_approval";
    }

    // Log the ChatGPT GPT Action usage explicitly
    await supabase.from("ai_events").insert([{
       user_id: userId,
       event_type: "chatgpt_action_executed",
       payload: { action, arguments: payload, result, status: executionStatus },
       status: "processed"
    }]);

    return new Response(JSON.stringify({ result, status: executionStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
