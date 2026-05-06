import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_brl: number;
  interval: string;
  max_clients: number | null;
  max_demands_per_month: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  mp_preapproval_plan_id: string | null;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  mp_preapproval_id: string | null;
  canceled_at: string | null;
}

export function usePlans() {
  return useQuery({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionPlan[];
    },
  });
}

export function useMySubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user_subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as (UserSubscription & { plan: SubscriptionPlan }) | null;
    },
  });

  const subscribe = useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke("subscription-checkout", {
        body: { plan_id: planId },
      });
      if (error) throw error;
      return data as { init_point?: string; free?: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_subscription", user?.id] }),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("subscription-cancel", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_subscription", user?.id] }),
  });

  return { ...query, subscription: query.data, subscribe, cancel };
}