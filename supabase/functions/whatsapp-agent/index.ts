import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { runAgentTurn } from "../_shared/ai-brain.ts";
import { sendWhatsApp } from "../_shared/whatsapp-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { 
      wa_message_id, 
      user_id, 
      client_id, 
      connection_id, 
      phone, 
      text, 
      contact_name 
    } = payload;

    if (!text || !user_id || !phone) {
      throw new Error("Missing required fields");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Identificar o número remetente e papel
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Consultar whatsapp_authorized_numbers
    const { data: authNumber } = await supabase
      .from("whatsapp_authorized_numbers")
      .select("*")
      .eq("user_id", user_id)
      .eq("phone_number", cleanPhone)
      .eq("is_active", true)
      .maybeSingle();

    let role = "unknown";
    let scoped_client_id = null;

    if (authNumber) {
      role = authNumber.access_role;
      scoped_client_id = authNumber.client_id;
    } else if (client_id) {
       // Se não tem em authorized_numbers, mas é cliente
       role = "client";
       scoped_client_id = client_id;
    }

    if (role === "unknown") {
      // Registrar log mas não processa resposta interna ou IA completa, 
      // ou pode responder com mensagem padrão
      const msg = "Seu número não está autorizado para interagir com este assistente.";
      await sendWhatsApp(supabase, user_id, {
        to: phone,
        content: msg,
      });
      return new Response(JSON.stringify({ status: "unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const channelMap: Record<string, string> = {
       "owner": "whatsapp_admin",
       "manager": "whatsapp_admin",
       "collaborator": "whatsapp_admin",
       "client": "whatsapp_client",
       "lead": "whatsapp_client"
    };

    const channel = channelMap[role] || "whatsapp_client";

    // Detectar confirmação pendente
    const isConfirm = text.trim() === "1" || text.trim().toLowerCase() === "1 - confirmar";
    const isEdit = text.trim() === "2" || text.trim().toLowerCase() === "2 - editar";
    const isCancel = text.trim() === "3" || text.trim().toLowerCase() === "3 - cancelar";

    if (isConfirm || isEdit || isCancel) {
       // Buscar ação pendente mais recente
       const { data: pendingAction } = await supabase
         .from("ai_actions")
         .select("*")
         .eq("user_id", user_id)
         .eq("status", "pending_approval")
         .order("created_at", { ascending: false })
         .limit(1)
         .maybeSingle();

       if (pendingAction) {
         if (new Date(pendingAction.confirmation_expires_at) < new Date()) {
           await supabase.from("ai_actions").update({ status: "expired" }).eq("id", pendingAction.id);
           await sendWhatsApp(supabase, user_id, { to: phone, content: "A solicitação de confirmação expirou. Por favor, crie uma nova." });
           return new Response(JSON.stringify({ status: "expired" }), { headers: corsHeaders });
         }

         if (isCancel) {
           await supabase.from("ai_actions").update({ status: "rejected", rejected_at: new Date().toISOString() }).eq("id", pendingAction.id);
           await sendWhatsApp(supabase, user_id, { to: phone, content: "Ação cancelada com sucesso." });
           return new Response(JSON.stringify({ status: "cancelled" }), { headers: corsHeaders });
         }

         if (isEdit) {
           await sendWhatsApp(supabase, user_id, { to: phone, content: "O que você gostaria de alterar na ação?" });
           return new Response(JSON.stringify({ status: "edit_requested" }), { headers: corsHeaders });
         }

         if (isConfirm) {
           // Aprovar e executar
           // Importamos executeAiTool apenas se for confirmar
           const { executeAiTool } = await import("../_shared/ai-tools.ts");
           try {
             const result = await executeAiTool(pendingAction.tool_name, pendingAction.arguments, {
                supabase, user_id, channel: channel as any, role: role as any, scoped_client_id
             });
             await supabase.from("ai_actions").update({ status: "executed" }).eq("id", pendingAction.id);
             
             await supabase.from("ai_events").insert([{
               user_id,
               event_type: "action_approved",
               channel,
               tool_name: pendingAction.tool_name,
               risk_level: pendingAction.risk_level,
               payload: { action_id: pendingAction.id, result },
               status: "processed"
             }]);

             await sendWhatsApp(supabase, user_id, { to: phone, content: "Ação executada com sucesso!\n" + JSON.stringify(result).substring(0, 500) });
           } catch (error: any) {
             await sendWhatsApp(supabase, user_id, { to: phone, content: "Erro ao executar ação: " + error.message });
           }
           return new Response(JSON.stringify({ status: "executed" }), { headers: corsHeaders });
         }
       }
    }

    // Passar para o ai-brain
    const brainResult = await runAgentTurn({
      supabase,
      user_id,
      message: text,
      channel: channel as any,
      role: role as any,
      scoped_client_id,
      external_identifier: phone, // usar o telefone como conversation identifier externo
    });

    // Enviar a resposta
    let finalResponse = brainResult.response;

    // Adicionar menu de confirmação se houver ações pendentes
    if (brainResult.pending_actions && brainResult.pending_actions.length > 0) {
      finalResponse += "\n\nResponda com:\n1 — Confirmar\n2 — Editar\n3 — Cancelar";
    }

    await sendWhatsApp(supabase, user_id, {
      to: phone,
      content: finalResponse,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
