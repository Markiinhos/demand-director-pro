import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type ClientInteraction = Tables<"client_interactions">;
export type ClientInteractionInsert = TablesInsert<"client_interactions">;

export function useClientInteractions(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["client_interactions", clientId],
    queryFn: async () => {
      let q = supabase.from("client_interactions").select("*").order("interaction_date", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ClientInteraction[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<ClientInteractionInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("client_interactions")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Update last_interaction_at on the client
      await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", input.client_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_interactions"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Interação registrada");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_interactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_interactions"] });
      toast.success("Interação removida");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { interactions: query.data ?? [], isLoading: query.isLoading, create, remove };
}
