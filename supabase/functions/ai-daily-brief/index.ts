import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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

    // Query 1: Overdue demands
    const nowISO = new Date().toISOString();
    const { data: overdueDemands } = await supabase
      .from("demands")
      .select("id, title, client_id, due_date")
      .eq("user_id", user.id)
      .neq("status", "finalizado")
      .lt("due_date", nowISO);

    // Query 2: Upcoming demands (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const { data: upcomingDemands } = await supabase
      .from("demands")
      .select("id, title, client_id, due_date")
      .eq("user_id", user.id)
      .neq("status", "finalizado")
      .gte("due_date", nowISO)
      .lte("due_date", nextWeek.toISOString());

    // Query 3: Overdue financials
    const { data: overdueFinancials } = await supabase
      .from("financial_entries")
      .select("id, description, amount, due_date, client_id")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .lt("due_date", nowISO);
      
    // Query 4: Pending AI Approvals
    const { data: pendingActions } = await supabase
      .from("ai_actions")
      .select("id, tool_name, risk_level")
      .eq("user_id", user.id)
      .eq("status", "pending_approval");

    const summary = {
      overdue_demands: overdueDemands?.length || 0,
      upcoming_demands: upcomingDemands?.length || 0,
      overdue_financials: overdueFinancials?.length || 0,
      overdue_financials_value: overdueFinancials?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
      pending_actions: pendingActions?.length || 0
    };

    // 5. Executar rotinas diárias configuráveis (Ex: cobrança dia 10)
    const { data: routines } = await supabase.from("ai_routines").select("*").eq("is_active", true);
    if (routines && routines.length > 0) {
      for (const rtn of routines) {
        // Lógica simplificada de cron (ex: "dia 10")
        if (rtn.schedule === String(new Date().getDate())) {
          // Cria a ação (pending_approval or pending execution) baseada na config da rotina
          await supabase.from("ai_actions").insert([{
            user_id: rtn.user_id,
            tool_name: rtn.routine_type, 
            arguments: rtn.configuration, // config params
            status: rtn.requires_approval ? "pending_approval" : "pending",
            risk_level: "high", // billing is always high/medium risk
            requires_approval: rtn.requires_approval
          }]);
        }
      }
    }

    // Save history
    await supabase.from("ai_events").insert([{
      user_id: user.id,
      event_type: "daily_brief_generated",
      payload: summary,
      status: "processed"
    }]);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
