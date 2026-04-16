import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PaymentCharge, CreatePixPayload, CreateBoletoPayload, CreateCardPayload } from "@/types/payments";

async function invokePayments(path: string, method: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/payments/${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export function usePayments() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<PaymentCharge[]>({
    queryKey: ["payment_charges"],
    queryFn: () => invokePayments("", "GET"),
    enabled: !!user,
  });

  const createPix = useMutation({
    mutationFn: (payload: CreatePixPayload) => invokePayments("create-pix", "POST", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Cobrança Pix criada"); },
    onError: (e: Error) => toast.error("Erro ao criar Pix: " + e.message),
  });

  const createBoleto = useMutation({
    mutationFn: (payload: CreateBoletoPayload) => invokePayments("create-boleto", "POST", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Boleto criado"); },
    onError: (e: Error) => toast.error("Erro ao criar boleto: " + e.message),
  });

  const createCard = useMutation({
    mutationFn: (payload: CreateCardPayload) => invokePayments("create-card", "POST", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Pagamento processado"); },
    onError: (e: Error) => toast.error("Erro no cartão: " + e.message),
  });

  const cancelCharge = useMutation({
    mutationFn: (id: string) => invokePayments(`${id}/cancel`, "POST"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Cobrança cancelada"); },
    onError: (e: Error) => toast.error("Erro ao cancelar: " + e.message),
  });

  return {
    charges: query.data ?? [],
    isLoading: query.isLoading,
    createPix,
    createBoleto,
    createCard,
    cancelCharge,
  };
}
