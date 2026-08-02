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

    // Identificar o usuário que configurou a chave GPT (usar Service Role para bypassar o request caso o authHeader refira a um token gerado via interface custom, ou usar getUser nativo se for JWT do Supabase).
    // O requisito: "Nunca confiar em user_id recebido pelo GPT. Identificar o usuário pela chave ou OAuth."
    if (!authHeader) throw new Error("Missing Authorization header.");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Acesso negado. Token/OAuth inválido ou expirado.");

    const { action, payload } = await req.json();

    if (!action) throw new Error("A field 'action' is required");

    let result = null;
    let executionStatus = "executed";

    // 10. GPT Actions & 8. Ferramentas do Agente Logic
    switch (action) {
      // Consultas (Baixo Risco)
      case "get_daily_priorities": {
         // Priorities = Atrasadas + Vence hoje
         const nowISO = new Date().toISOString();
         const { data: demands } = await supabase.from("demands").select("id, title, status, due_date").eq("user_id", user.id).neq("status", "finalizado");
         result = demands; // simplificado pro payload
         break;
      }
      case "list_overdue_demands": {
         const { data: overdue } = await supabase.from("demands").select("*").eq("user_id", user.id).neq("status", "finalizado").lt("due_date", new Date().toISOString());
         result = overdue;
         break;
      }
      case "get_agency_metrics": {
         // Exemplo the calculo de metricas simplificado
         const { data: demands } = await supabase.from("demands").select("id").eq("user_id", user.id);
         const { data: revenue } = await supabase.from("financial_entries").select("amount").eq("user_id", user.id).eq("status", "pago").eq("type", "entrada");
         result = {
            total_demands: demands?.length || 0,
            revenue_collected: revenue?.reduce((a: number, b: any) => a + (b.amount || 0), 0) || 0
         };
         break;
      }
      case "list_expiring_contracts": {
         // Supondo schema de contracts
         result = "Recurso list_expiring_contracts em construção";
         break;
      }
      
      // Ações Médio/Alto Risco (exigem aprovação)
      case "create_demand":
      case "prepare_collection":
      case "update_demand":
      case "generate_payment_link":
      case "create_meeting_agenda":
      default: {
         let risk = "medium";
         if (["generate_payment_link", "prepare_collection", "delete_demand", "send_whatsapp"].includes(action)) {
           risk = "high";
         }
         
         const { data, error } = await supabase.from("ai_actions").insert([{
           user_id: user.id,
           tool_name: action,
           arguments: payload || {},
           status: "pending_approval",
           risk_level: risk,
           requires_approval: true
         }]).select().single();

         if (error) throw error;
         
         result = data;
         executionStatus = "pending_approval";
         break;
      }
    }

    // "Registrar todas as chamadas com origem chatgpt_action."
    await supabase.from("ai_events").insert([{
       user_id: user.id,
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
