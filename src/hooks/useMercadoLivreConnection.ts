import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface MercadoLivreConnection {
  id: string;
  user_id: string;
  seller_id: string | null;
  nickname: string | null;
  status: "connected" | "expired" | "disconnected";
  expires_at: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useMercadoLivreConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["mercadolivre_connection"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("mercadolivre_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return (data as MercadoLivreConnection | null);
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (payload: { code: string; redirectUri: string; appId: string; clientSecret: string }) => {
      const { data, error } = await supabase.functions.invoke("mercadolivre-auth", {
        body: { action: "connect", ...payload },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao conectar com Mercado Livre");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mercadolivre_connection"] });
      toast({
        title: "Mercado Livre Conectado!",
        description: data.message || "Sua conta do Mercado Livre foi conectada com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro de Conexão",
        description: err.message || "Falha ao conectar com Mercado Livre.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mercadolivre-auth", {
        body: { action: "disconnect" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercadolivre_connection"] });
      toast({
        title: "Mercado Livre Desconectado",
        description: "A integração foi removida.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao Desconectar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    connection: query.data,
    isLoading: query.isLoading,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
