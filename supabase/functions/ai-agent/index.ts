import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ALLOWED_TOOLS, executeAiTool } from "../_shared/ai-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "configuration_error", message: "OPENAI_API_KEY ausente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { message, conversation_id } = await req.json();
    if (!message) throw new Error("Message is required.");

    // Retrieve Agent Config
    const { data: agentData } = await supabase.from("ai_agents").select("*").eq("user_id", user.id).limit(1).maybeSingle();
    const systemPrompt = agentData?.system_prompt || "You are an assistant.";
    const model = agentData?.model || "gpt-4o-mini";
    
    // Retrieve Knowledge Context
    const { data: knowledge } = await supabase.from("ai_knowledge").select("*").eq("user_id", user.id).limit(3);
    const knowledgeText = knowledge?.map(k => `[${k.title}]: ${k.content}`).join("\n\n") || "";
    
    const augmentedPrompt = `${systemPrompt}\n\nConhecimento Adicional:\n${knowledgeText}`;

    // Conversation
    let activeConversationId = conversation_id;
    if (!activeConversationId) {
      const { data: conv } = await supabase
        .from("ai_conversations")
        .insert([{ user_id: user.id, title: message.substring(0, 30) }])
        .select().single();
      activeConversationId = conv?.id;
    }

    await supabase.from("ai_messages").insert([{ user_id: user.id, conversation_id: activeConversationId, role: "user", content: message }]);

    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: false })
      .limit(10);
      
    const formattedHistory = (history || []).reverse().map(h => ({ role: h.role, content: h.content }));

    const toolsDefinition = ALLOWED_TOOLS.map(t => ({
      type: "function",
      function: {
        name: t,
        description: `Tool for ${t}`,
        parameters: { type: "object", properties: {
           // Forcing basic catchall since we validate with Zod in backend
           payload: { type: "object", description: "JSON mapping arguments" } 
        } } 
      }
    }));

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: model,
        temperature: 0.7,
        messages: [{ role: "system", content: augmentedPrompt }, ...formattedHistory],
        tools: toolsDefinition,
        tool_choice: "auto"
      })
    });

    const gptData = await gptRes.json();
    let aiResponseMsg = "Desculpe, falha na geração.";

    if (gptData.choices && gptData.choices.length > 0) {
      const choice = gptData.choices[0].message;

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        const funcName = toolCall.function.name;
        // Parse OpenAI arguments structure (it might wrap in payload or provide directly based on definitions, handling both)
        let funcArgs = {};
        try {
           const parsed = JSON.parse(toolCall.function.arguments || "{}");
           funcArgs = parsed.payload ? parsed.payload : parsed;
        } catch(e) {}
        
        // Define Risk
        const lowRiskTools = ["get_daily_summary", "list_overdue_demands", "list_upcoming_demands", "search_clients", "get_client_context", "list_expiring_contracts"];
        const isLowRisk = lowRiskTools.includes(funcName);
        
        if (isLowRisk) {
           // Execute immediately returning details as aiResponseMsg
           try {
              const res = await executeAiTool(funcName, funcArgs, { supabase, user_id: user.id });
              aiResponseMsg = `Consulta realizada (${funcName}): ` + JSON.stringify(res).substring(0, 300) + "...";
           } catch (e:any) {
              aiResponseMsg = `Erro na consulta ${funcName}: ` + e.message;
           }
        } else {
           // Create pending action
           const riskLevel = ["prepare_collection", "create_notification"].includes(funcName) ? "high" : "medium";
           await supabase.from("ai_actions").insert([{
              user_id: user.id,
              conversation_id: activeConversationId,
              tool_name: funcName,
              arguments: funcArgs,
              status: "pending_approval",
              risk_level: riskLevel,
              requires_approval: true
           }]);
           aiResponseMsg = `Para realizar a ação de ${funcName}, criei uma solicitação. Aprove na sua fila de Aprovações.`;
        }
      } else {
        aiResponseMsg = choice.content || "Desculpe, não consegui entender.";
      }
    }

    await supabase.from("ai_messages").insert([{ user_id: user.id, conversation_id: activeConversationId, role: "assistant", content: aiResponseMsg }]);

    return new Response(JSON.stringify({ response: aiResponseMsg, conversation_id: activeConversationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
