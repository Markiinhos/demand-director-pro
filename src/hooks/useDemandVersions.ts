import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useDemandVersions(demandId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const versions = useQuery({
    queryKey: ["demand_versions", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_versions")
        .select("*")
        .eq("demand_id", demandId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!demandId,
  });

  const feedback = useQuery({
    queryKey: ["demand_feedback", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_feedback")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!demandId,
  });

  const upload = useMutation({
    mutationFn: async ({ file, notes }: { file: File; notes?: string }) => {
      if (!demandId || !user) throw new Error("Sem contexto");
      const last = versions.data?.[0]?.version_number ?? 0;
      const next = last + 1;
      const path = `${user.id}/demands/${demandId}/v${next}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("client-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("client-files").getPublicUrl(path);
      const { error } = await supabase.from("demand_versions").insert({
        user_id: user.id,
        demand_id: demandId,
        version_number: next,
        file_url: pub.publicUrl,
        file_name: file.name,
        notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand_versions", demandId] });
      toast.success("Versão enviada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return {
    versions: versions.data ?? [],
    feedback: feedback.data ?? [],
    isLoading: versions.isLoading,
    upload,
  };
}