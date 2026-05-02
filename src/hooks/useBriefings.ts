import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";

function randomToken(len = 24) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type BriefingField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

export function useBriefings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["briefings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("briefings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"briefings">, "user_id" | "token">) => {
      const { data, error } = await supabase.from("briefings").insert({
        ...input,
        user_id: user!.id,
        token: randomToken(),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success("Briefing criado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("briefings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefings"] }),
  });

  const responsesFor = (briefingId: string) =>
    useQuery({
      queryKey: ["briefing_responses", briefingId],
      queryFn: async () => {
        const { data, error } = await supabase.from("briefing_responses").select("*").eq("briefing_id", briefingId).order("submitted_at", { ascending: false });
        if (error) throw error;
        return data;
      },
      enabled: !!user && !!briefingId,
    });

  return { briefings: list.data ?? [], isLoading: list.isLoading, create, remove, responsesFor };
}