import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;

export function useClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<ClientInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente criado com sucesso");
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("PLAN_LIMIT_CLIENTS")) {
        toast.error("Limite do plano atingido", {
          description: msg.split("PLAN_LIMIT_CLIENTS:")[1]?.trim() ?? "Faça upgrade para Pro.",
          action: { label: "Ver planos", onClick: () => (window.location.href = "/planos") },
        });
      } else {
        toast.error("Erro ao criar cliente: " + msg);
      }
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ClientUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado");
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  return { clients: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
