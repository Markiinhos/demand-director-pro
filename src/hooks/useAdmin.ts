import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ManagedAccount {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  plan_id: string | null;
  status: string | null;
  is_super_admin: boolean;
}

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_super_admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useManagedAccounts() {
  const { data: isAdmin } = useIsSuperAdmin();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["managed_accounts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [profilesRes, subsRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email, avatar_url, created_at").order("created_at"),
        supabase.from("user_subscriptions").select("user_id, plan_id, status"),
        supabase.from("user_roles").select("user_id, role").eq("role", "super_admin"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (subsRes.error) throw subsRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const subs = new Map((subsRes.data ?? []).map((s: any) => [s.user_id, s]));
      const admins = new Set((rolesRes.data ?? []).map((r: any) => r.user_id));

      return (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        plan_id: subs.get(p.id)?.plan_id ?? null,
        status: subs.get(p.id)?.status ?? null,
        is_super_admin: admins.has(p.id),
      })) as ManagedAccount[];
    },
  });

  const setPlan = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }) => {
      const { data: existing } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_subscriptions")
          .update({ plan_id: planId, status: "active", canceled_at: null })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_subscriptions")
          .insert({ user_id: userId, plan_id: planId, status: "active" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed_accounts"] }),
  });

  const setSuperAdmin = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "super_admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "super_admin");
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed_accounts"] }),
  });

  return { ...query, accounts: query.data ?? [], setPlan, setSuperAdmin };
}
