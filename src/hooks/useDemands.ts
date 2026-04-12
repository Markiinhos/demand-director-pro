import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Demand = Tables<"demands">;
export type DemandInsert = TablesInsert<"demands">;
export type DemandUpdate = TablesUpdate<"demands">;

export function useDemands() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["demands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demand[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<DemandInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("demands")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda criada com sucesso");
    },
    onError: (e) => toast.error("Erro ao criar demanda: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: DemandUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("demands")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda atualizada");
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda removida");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  return { demands: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
