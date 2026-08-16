import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface AsaasConnection {
  id: string;
  user_id: string;
  environment: "sandbox" | "production";
  status: "connected" | "disconnected" | "error";
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useAsaasConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["asaas_connection"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("asaas_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return (data as AsaasConnection | null);
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({ apiKey, environment }: { apiKey: string; environment: "sandbox" | "production" }) => {
      const { data, error } = await supabase.functions.invoke("asaas-connect", {
        body: { action: "connect", apiKey, environment },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao conectar com Asaas");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["asaas_connection"] });
      toast({
        title: "Asaas Conectado!",
        description: data.message || "Sua conta do Asaas foi vinculada com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro na Conexão",
        description: err.message || "Falha ao conectar com o Asaas.",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("asaas-connect", {
        body: { action: "test" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Conexão com Asaas inativa");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["asaas_connection"] });
      toast({
        title: "Conexão Ativa!",
        description: `Saldo em conta Asaas: R$ ${Number(data.balance || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["asaas_connection"] });
      toast({
        title: "Erro no Teste",
        description: err.message || "Não foi possível comunicar com o Asaas.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("asaas-connect", {
        body: { action: "disconnect" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas_connection"] });
      toast({
        title: "Asaas Desconectado",
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
    isError: query.isError,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    testConnection: testMutation.mutate,
    isTesting: testMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
