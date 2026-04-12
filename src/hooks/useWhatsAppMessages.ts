import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type WhatsAppMessage = Tables<"whatsapp_messages">;

export function useWhatsAppMessages(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["whatsapp_messages", clientId],
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async (input: {
      clientId: string;
      content: string;
      phone: string;
      messageType?: string;
      templateName?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    }) => {
      // Save message as queued
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          user_id: user!.id,
          client_id: input.clientId,
          direction: "outbound",
          message_type: input.messageType || "text",
          template_name: input.templateName || null,
          content: input.content,
          status: "queued",
          related_entity_type: input.relatedEntityType || null,
          related_entity_id: input.relatedEntityId || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Call edge function to actually send
      try {
        const { error: fnError } = await supabase.functions.invoke("whatsapp-send", {
          body: {
            messageId: data.id,
            phone: input.phone,
            content: input.content,
            messageType: input.messageType || "text",
            templateName: input.templateName,
          },
        });
        if (fnError) {
          await supabase
            .from("whatsapp_messages")
            .update({ status: "failed", error_message: fnError.message })
            .eq("id", data.id);
          throw fnError;
        }
      } catch (err: any) {
        // If edge function not deployed yet, just keep as queued
        if (err?.message?.includes("Function not found")) {
          toast.info("Mensagem salva. Configure a integração WhatsApp para envio automático.");
          return data;
        }
        throw err;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_messages"] });
      toast.success("Mensagem enviada");
    },
    onError: (e) => toast.error("Erro ao enviar: " + e.message),
  });

  return { messages: query.data ?? [], isLoading: query.isLoading, sendMessage };
}
