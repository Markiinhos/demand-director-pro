import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface MercadoLivreOrder {
  id: string;
  user_id: string;
  ml_order_id: string;
  ml_pack_id: string | null;
  status: string;
  buyer_id: string | null;
  buyer_name: string | null;
  total_amount: number;
  currency_id: string | null;
  order_date: string | null;
  raw_payload: any;
  synced_at: string;
}

export function useMercadoLivreOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["mercadolivre_orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("mercadolivre_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("order_date", { ascending: false });

      if (error) throw error;
      return (data as MercadoLivreOrder[]);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ createDemands = true }: { createDemands?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke("mercadolivre-orders", {
        body: { create_demands: createDemands },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar pedidos do Mercado Livre");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mercadolivre_orders"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast({
        title: "Sincronização Concluída!",
        description: `${data.count || 0} pedidos sincronizados. ${data.created_demands?.length || 0} demandas criadas no CRM.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao Sincronizar",
        description: err.message || "Não foi possível carregar os pedidos do Mercado Livre.",
        variant: "destructive",
      });
    },
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    syncOrders: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
