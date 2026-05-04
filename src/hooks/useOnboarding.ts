import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingState {
  user_id: string;
  completed: boolean;
  current_step: number;
  steps_done: string[];
  dismissed_at: string | null;
}

export function useOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["onboarding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_onboarding")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OnboardingState | null;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<OnboardingState>) => {
      const { error } = await supabase.from("user_onboarding").upsert({
        user_id: user!.id,
        ...patch,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", user?.id] }),
  });

  const complete = () => update.mutate({ completed: true, current_step: 4 });
  const dismiss = () => update.mutate({ dismissed_at: new Date().toISOString() });
  const setStep = (step: number) => update.mutate({ current_step: step });

  return { state: query.data, isLoading: query.isLoading, update, complete, dismiss, setStep };
}