import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type FinancialEntry = Tables<"financial_entries">;
export type FinancialInsert = TablesInsert<"financial_entries">;
export type FinancialUpdate = TablesUpdate<"financial_entries">;

export function useFinancial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<FinancialInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("financial_entries")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Lançamento criado com sucesso");
    },
    onError: (e) => toast.error("Erro ao criar lançamento: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: FinancialUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("financial_entries")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Lançamento atualizado");
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Lançamento removido");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  return { entries: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
