import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PaymentsBackendStatus } from "@/lib/payments/config";

async function call(path: string, method: "GET" | "POST") {
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
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "message" in (data as Record<string, unknown>))
      ? String((data as Record<string, unknown>).message)
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
        if (d.status === "success") toast.success("Mercado Pago conectado");
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

  const disconnect = useMutation({
    mutationFn: () => call("disconnect", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments_config_status"] });
      toast.success("Conta Mercado Pago desconectada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { status, connect, disconnect };
}