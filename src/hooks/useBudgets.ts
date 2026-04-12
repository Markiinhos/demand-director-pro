import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Budget = Tables<"budgets">;
export type BudgetItem = Tables<"budget_items">;
export type BudgetInsert = TablesInsert<"budgets">;
export type BudgetItemInsert = TablesInsert<"budget_items">;

export function useBudgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async ({ items, ...budget }: Omit<BudgetInsert, "user_id"> & { items: Omit<BudgetItemInsert, "user_id" | "budget_id">[] }) => {
      const totalAmount = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unit_price ?? 0), 0);
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...budget, user_id: user!.id, total_amount: totalAmount })
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          budget_id: data.id,
          user_id: user!.id,
          subtotal: (item.quantity ?? 1) * (item.unit_price ?? 0),
        }));
        const { error: itemsError } = await supabase.from("budget_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento criado com sucesso");
    },
    onError: (e) => toast.error("Erro ao criar orçamento: " + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, items, ...budget }: TablesUpdate<"budgets"> & { id: string; items?: Omit<BudgetItemInsert, "user_id" | "budget_id">[] }) => {
      const updateData: TablesUpdate<"budgets"> = { ...budget };
      if (items) {
        updateData.total_amount = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unit_price ?? 0), 0);
      }
      const { error } = await supabase.from("budgets").update(updateData).eq("id", id);
      if (error) throw error;

      if (items) {
        await supabase.from("budget_items").delete().eq("budget_id", id);
        if (items.length > 0) {
          const itemsToInsert = items.map(item => ({
            ...item,
            budget_id: id,
            user_id: user!.id,
            subtotal: (item.quantity ?? 1) * (item.unit_price ?? 0),
          }));
          const { error: itemsError } = await supabase.from("budget_items").insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento atualizado");
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento removido");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error } = await supabase.from("budgets").select("*").eq("id", id).single();
      if (error) throw error;

      const { data: items, error: itemsErr } = await supabase.from("budget_items").select("*").eq("budget_id", id);
      if (itemsErr) throw itemsErr;

      const { data: newBudget, error: createErr } = await supabase
        .from("budgets")
        .insert({
          user_id: user!.id,
          client_id: original.client_id,
          title: `${original.title} (cópia)`,
          description: original.description,
          notes: original.notes,
          status: "rascunho" as const,
          valid_until: original.valid_until,
          total_amount: original.total_amount,
        })
        .select()
        .single();
      if (createErr) throw createErr;

      if (items && items.length > 0) {
        const newItems = items.map(({ id: _id, budget_id: _bid, created_at: _ca, ...rest }) => ({
          ...rest,
          budget_id: newBudget.id,
          user_id: user!.id,
        }));
        await supabase.from("budget_items").insert(newItems);
      }
      return newBudget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento duplicado");
    },
    onError: (e) => toast.error("Erro ao duplicar: " + e.message),
  });

  const getItems = async (budgetId: string) => {
    const { data, error } = await supabase
      .from("budget_items")
      .select("*")
      .eq("budget_id", budgetId)
      .order("created_at");
    if (error) throw error;
    return data as BudgetItem[];
  };

  return { budgets: query.data ?? [], isLoading: query.isLoading, create, update, remove, duplicate, getItems };
}
