import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useAIAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Get current conversaton logic
  const { data: conversation } = useQuery({
    queryKey: ["ai_conversation", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("user_id", user?.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 2. Fetch Messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["ai_messages", conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.id,
  });

  // 3. Send Message Mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: { 
          message, 
          conversation_id: conversation?.id 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_messages"] });
      queryClient.invalidateQueries({ queryKey: ["ai_actions"] });
    },
    onError: (error) => {
      toast.error("Erro ao enviar mensagem: " + error.message);
    }
  });

  return {
    conversation,
    messages,
    loadingMessages,
    sendMessage
  };
}
