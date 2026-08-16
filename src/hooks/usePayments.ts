import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  PaymentCharge,
  CreatePixPayload,
  CreateBoletoPayload,
  CreatePaymentLinkPayload,
} from "@/types/payments";
import {
  validateMercadoPagoBackendStatus,
  type PaymentsBackendStatus,
} from "@/lib/payments/config";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lwabrwtqwveqrkwegikg.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3YWJyd3Rxd3ZlcXJrd2VnaWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTYyNzMsImV4cCI6MjA5MTI3MjI3M30.QxPcO--ZyR2bj55Le5Z5gWv1L9RFf0ybtda1pvdeqzo";

class PaymentsRequestError extends Error {
  status?: string | null;
  statusDetail?: string | null;
  code?: string | number | null;
  detail?: string | null;
  cause?: unknown;
  httpStatus?: number | null;

  constructor(message: string, init?: Partial<PaymentsRequestError>) {
    super(message);
    this.name = "PaymentsRequestError";
    Object.assign(this, init);
  }
}

function buildPaymentsError(data: unknown, fallbackMessage: string, httpStatus: number) {
  if (typeof data === "object" && data) {
    const payload = data as Record<string, unknown>;
    const message = typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : fallbackMessage;
    const detail = typeof payload.detail === "string" ? payload.detail : null;
    const statusDetail = typeof payload.status_detail === "string" ? payload.status_detail : null;
    const code = typeof payload.code === "string" || typeof payload.code === "number" ? payload.code : null;
    const formattedMessage = [
      message,
      detail,
      statusDetail && statusDetail !== detail ? `status_detail: ${statusDetail}` : null,
    ].filter(Boolean).join(" • ");
    return new PaymentsRequestError(formattedMessage || fallbackMessage, {
      status: typeof payload.status === "string" ? payload.status : null,
      statusDetail,
      code,
      detail,
      cause: payload.cause,
      httpStatus: typeof payload.http_status === "number" ? payload.http_status : httpStatus,
    });
  }
  return new PaymentsRequestError(fallbackMessage, { httpStatus });
}

async function invokePayments(path: string, method: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");
  const cleanPath = path ? `${path}` : "";
  const url = `${SUPABASE_URL}/functions/v1/payments/${cleanPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text || "Erro na requisição" }; }
  if (!res.ok) {
    const fallback = typeof data === "object" && data && "message" in data
      ? String((data as { message: unknown }).message)
      : typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : text || "Erro na requisição";
    throw buildPaymentsError(data, fallback, res.status);
  }
  return data;
}

async function fetchPaymentsConfigStatus() {
  return invokePayments("config-status", "GET") as Promise<PaymentsBackendStatus>;
}

export function usePayments() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const ensurePaymentsSetup = async () => {
    const backendStatus = await qc.fetchQuery({
      queryKey: ["payments_config_status"],
      queryFn: fetchPaymentsConfigStatus,
      staleTime: 60_000,
    });
    const error = validateMercadoPagoBackendStatus(backendStatus);
    if (error) throw new Error(error);
  };

  const query = useQuery<PaymentCharge[]>({
    queryKey: ["payment_charges"],
    queryFn: () => invokePayments("", "GET") as Promise<PaymentCharge[]>,
    enabled: !!user,
    refetchInterval: (q) => {
      const data = q.state.data as PaymentCharge[] | undefined;
      const hasPending = data?.some((c) =>
        ["pending", "awaiting_payment", "in_process", "authorized"].includes(c.status),
      );
      return hasPending ? 15_000 : false;
    },
    refetchOnWindowFocus: true,
  });

  const lastApprovedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const charges = query.data ?? [];
    let changed = false;
    for (const c of charges) {
      if (c.status === "approved" && !lastApprovedRef.current.has(c.id)) {
        lastApprovedRef.current.add(c.id);
        changed = true;
      }
    }
    if (changed) {
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
    }
  }, [query.data, qc]);

  const createPix = useMutation({
    mutationFn: async (payload: CreatePixPayload) => {
      await ensurePaymentsSetup();
      return invokePayments("create-pix", "POST", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Cobrança Pix criada"); },
    onError: (e: Error) => toast.error("Erro ao criar Pix: " + e.message),
  });

  const createBoleto = useMutation({
    mutationFn: async (payload: CreateBoletoPayload) => {
      await ensurePaymentsSetup();
      return invokePayments("create-boleto", "POST", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Boleto criado"); },
    onError: (e: Error) => toast.error("Erro ao criar boleto: " + e.message),
  });

  const createPaymentLink = useMutation({
    mutationFn: async (payload: CreatePaymentLinkPayload) => {
      await ensurePaymentsSetup();
      return invokePayments("create-link", "POST", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_charges"] }); toast.success("Link de pagamento criado"); },
    onError: (e: Error) => toast.error("Erro ao criar link: " + e.message),
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
    createPaymentLink,
    cancelCharge,
  };
}
