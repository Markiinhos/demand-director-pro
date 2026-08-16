import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface AsaasCharge {
  id: string;
  user_id: string;
  client_id: string | null;
  demand_id: string | null;
  financial_entry_id: string | null;
  asaas_payment_id: string | null;
  status: string;
  billing_type: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  amount: number;
  due_date: string;
  description: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_payload: string | null;
  pix_qr_code: string | null;
  paid_at: string | null;
  external_reference: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface CreateAsaasChargePayload {
  client_id: string;
  amount: number;
  billing_type: "PIX" | "BOLETO" | "CREDIT_CARD";
  due_date: string;
  description?: string;
  demand_id?: string;
  financial_entry_id?: string;
}

export function useAsaasCharges() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["asaas_charges"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("asaas_charges")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as AsaasCharge[]);
    },
  });

  const createChargeMutation = useMutation({
    mutationFn: async (payload: CreateAsaasChargePayload) => {
      const { data, error } = await supabase.functions.invoke("asaas-create-charge", {
        body: payload,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao gerar cobrança no Asaas");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["asaas_charges"] });
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast({
        title: "Cobrança Gerada!",
        description: `Cobrança criada via ${data.charge?.billing_type || "Asaas"}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao Gerar Cobrança",
        description: err.message || "Não foi possível criar a cobrança no Asaas.",
        variant: "destructive",
      });
    },
  });

  const syncClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke("asaas-sync-customer", {
        body: { client_id: clientId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar cliente com o Asaas");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Cliente Sincronizado!",
        description: "Os dados do cliente foram atualizados no Asaas.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao Sincronizar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    charges: query.data || [],
    isLoading: query.isLoading,
    createCharge: createChargeMutation.mutate,
    isCreating: createChargeMutation.isPending,
    createChargeAsync: createChargeMutation.mutateAsync,
    syncClient: syncClientMutation.mutate,
    isSyncingClient: syncClientMutation.isPending,
  };
}
