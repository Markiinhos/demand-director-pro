import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

    // Check payload
    const { message, conversation_id } = await req.json();
    if (!message) throw new Error("Message is required.");

    // Retrieve or create conversation
    let activeConversationId = conversation_id;
    if (!activeConversationId) {
      const { data: conv, error: convError } = await supabase
        .from("ai_conversations")
        .insert([{ user_id: user.id, title: message.substring(0, 30) }])
        .select()
        .single();
      if (convError) throw convError;
      activeConversationId = conv.id;
    }

    // Save user message
    await supabase.from("ai_messages").insert([{
      user_id: user.id,
      conversation_id: activeConversationId,
      role: "user",
      content: message,
    }]);

    // Load recent history (last 10 messages)
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    const formattedHistory = (history || []).reverse().map(h => ({
      role: h.role,
      content: h.content
    }));

    // Setup Tools
    const tools = [
      {
        type: "function",
        function: {
          name: "get_daily_summary",
          description: "Gera o resumo diário operacional",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "create_demand",
          description: "Cria uma nova demanda para um cliente",
          parameters: {
            type: "object",
            properties: {
              client_id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              due_date: { type: "string" },
            },
            required: ["client_id", "title"]
          }
        }
      }
    ];

    // Call OpenAI
    let aiResponseMsg = "No response from AI.";
    if (OPENAI_API_KEY) {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are the Demand Director Pro AI assistant. Help the user manage their agency. If creating/mutating data, you MUST use the appropriate tool." },
            ...formattedHistory
          ],
          tools: tools,
          tool_choice: "auto"
        })
      });

      const gptData = await gptRes.json();
      
      if (gptData.choices && gptData.choices.length > 0) {
        const choice = gptData.choices[0].message;
        
        // Log Usage
        if (gptData.usage) {
          await supabase.from("ai_usage_logs").insert([{
            user_id: user.id,
            provider: "openai",
            model: "gpt-4o-mini",
            prompt_tokens: gptData.usage.prompt_tokens,
            completion_tokens: gptData.usage.completion_tokens,
            total_tokens: gptData.usage.total_tokens
          }]);
        }

        if (choice.tool_calls && choice.tool_calls.length > 0) {
          const toolCall = choice.tool_calls[0];
          const funcName = toolCall.function.name;
          const funcArgs = JSON.parse(toolCall.function.arguments || "{}");
          
          const riskLevel = funcName === "create_demand" ? "medium" : "low";
          const requiresApproval = riskLevel === "medium" || riskLevel === "high";
          
          await supabase.from("ai_actions").insert([{
            user_id: user.id,
            conversation_id: activeConversationId,
            tool_name: funcName,
            arguments: funcArgs,
            status: requiresApproval ? "pending_approval" : "pending",
            risk_level: riskLevel,
            requires_approval: requiresApproval
          }]);

          aiResponseMsg = `Entendi. Para ${funcName === 'create_demand' ? 'criar a demanda' : 'processar isso'}, a ação foi enviada para ${requiresApproval ? 'aprovação manual na sua fila' : 'execução automática e será concluída em breve'}. Algo mais?`;
        } else {
          aiResponseMsg = choice.content || "Desculpe, não consegui gerar uma resposta.";
        }
      }
    } else {
      // Stub fallback if no API key is provided locally
      aiResponseMsg = "Chave da OpenAI não configurada (OPENAI_API_KEY ausente). Simulando resposta segura recebida pelo usuário.";
    }

    // Save Assistant Message
    await supabase.from("ai_messages").insert([{
      user_id: user.id,
      conversation_id: activeConversationId,
      role: "assistant",
      content: aiResponseMsg
    }]);

    return new Response(
      JSON.stringify({ response: aiResponseMsg, conversation_id: activeConversationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
