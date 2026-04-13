import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CostItem {
  description: string;
  value: number;
}

export interface FreelancerSettings {
  id: string;
  user_id: string;
  desired_salary: number;
  weekly_days: number;
  daily_hours: number;
  vacation_weeks: number;
  monthly_costs: CostItem[];
  calculated_hour_rate: number;
  created_at: string;
  updated_at: string;
}

export function useFreelancerSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["freelancer_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancer_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as FreelancerSettings | null;
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (settings: Partial<Omit<FreelancerSettings, "id" | "user_id" | "created_at" | "updated_at">>) => {
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from("freelancer_settings")
          .update(settings)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("freelancer_settings")
          .insert({ ...settings, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer_settings"] });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}
