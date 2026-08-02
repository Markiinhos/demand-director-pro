import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req: any) => {
  try {
    // Configura cliente admin para rodar rotinas globais (bypass RLS por ser backend job)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Pegar Timezone específico
    const dateOpts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const dateSp = new Intl.DateTimeFormat('pt-BR', dateOpts).format(new Date());
    const [day, month, year] = dateSp.split('/');
    const todayStr = day; // "10" for dia 10

    const { data: routines, error } = await supabase.from("ai_routines").select("*").eq("is_active", true);
    if (error) throw error;
    
    let processed = 0;

    if (routines && routines.length > 0) {
      for (const rtn of routines) {
        if (rtn.schedule === todayStr) {
          // rule: routine_id + client_id + ano + mês + tipo
          const keyParams = [rtn.id, rtn.client_id || 'global', year, month, rtn.routine_type].join('_');
          
          // Verify if idempotency key already exists
          const { data: existingAction } = await supabase
            .from("ai_actions")
            .select("id")
            .eq("idempotency_key", keyParams)
            .maybeSingle();

          if (!existingAction) {
             const { error: insErr } = await supabase.from("ai_actions").insert([{
                user_id: rtn.user_id,
                tool_name: rtn.routine_type, 
                arguments: typeof rtn.configuration === 'string' ? JSON.parse(rtn.configuration) : rtn.configuration,
                status: rtn.requires_approval ? "pending_approval" : "pending",
                risk_level: "high",
                requires_approval: rtn.requires_approval,
                idempotency_key: keyParams
             }]);
             if (!insErr) {
                 processed++;
                 const nextRunAt = new Date();
                 nextRunAt.setMonth(nextRunAt.getMonth() + 1);
                 await supabase.from("ai_routines").update({ 
                    last_run_at: new Date().toISOString(),
                    next_run_at: nextRunAt.toISOString()
                 }).eq("id", rtn.id);
             }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
