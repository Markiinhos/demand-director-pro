import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PaymentsBackendStatus } from "@/lib/payments/config";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lwabrwtqwveqrkwegikg.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3YWJyd3Rxd3ZlcXJrd2VnaWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTYyNzMsImV4cCI6MjA5MTI3MjI3M30.QxPcO--ZyR2bj55Le5Z5gWv1L9RFf0ybtda1pvdeqzo";

async function call(path: string, method: "GET" | "POST", body?: unknown) {
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
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "message" in (data as Record<string, unknown>))
      ? String((data as Record<string, unknown>).message)
      : (data && typeof data === "object" && "error" in (data as Record<string, unknown>))
        ? String((data as Record<string, unknown>).error)
        : "Erro na requisição";
    throw new Error(msg);
  }
  return data;
}

export function useMpConnection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const status = useQuery<PaymentsBackendStatus>({
    queryKey: ["payments_config_status"],
    queryFn: () => call("config-status", "GET") as Promise<PaymentsBackendStatus>,
    enabled: !!user,
    staleTime: 30_000,
  });

  // Recebe mensagem do popup do callback OAuth para atualizar o status.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; status?: string } | null;
      if (d?.type === "mp-oauth") {
        if (d.status === "success") toast.success("Mercado Pago conectado com sucesso!");
        else toast.error("Falha ao conectar Mercado Pago");
        qc.invalidateQueries({ queryKey: ["payments_config_status"] });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  const connect = useMutation({
    mutationFn: async () => {
      const r = await call("oauth-start", "POST") as { authorize_url: string };
      const popup = window.open(r.authorize_url, "mp-oauth", "width=560,height=720");
      if (!popup) throw new Error("Pop-up bloqueado. Permita pop-ups e tente novamente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectWithToken = useMutation({
    mutationFn: async (accessToken: string) => {
      return call("manual-connect", "POST", { access_token: accessToken.trim() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments_config_status"] });
      toast.success("Mercado Pago conectado com sucesso via Access Token!");
    },
    onError: (e: Error) => toast.error("Erro ao conectar: " + e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => call("disconnect", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments_config_status"] });
      toast.success("Conta Mercado Pago desconectada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { status, connect, connectWithToken, disconnect };
}