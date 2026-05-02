import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function randomToken(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function usePortalTokens(clientId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["portal_tokens", clientId],
    queryFn: async () => {
      let q = supabase.from("client_portal_tokens").select("*").order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: { client_id: string; expires_at?: string | null }) => {
      const { data, error } = await supabase.from("client_portal_tokens").insert({
        user_id: user!.id,
        client_id: input.client_id,
        token: randomToken(),
        expires_at: input.expires_at ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_tokens"] });
      toast.success("Link do portal gerado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_portal_tokens").update({ revoked: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_tokens"] });
      toast.success("Link revogado");
    },
  });

  return { tokens: list.data ?? [], isLoading: list.isLoading, create, revoke };
}