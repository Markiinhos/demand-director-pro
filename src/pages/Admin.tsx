import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Crown, Loader2, Search, Shield, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans } from "@/hooks/useSubscription";
import { useIsSuperAdmin, useManagedAccounts } from "@/hooks/useAdmin";

export default function Admin() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: checking } = useIsSuperAdmin();
  const { accounts, isLoading, setPlan, setSuperAdmin } = useManagedAccounts();
  const { data: plans } = usePlans();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(q));
  }, [accounts, search]);

  if (checking) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const changePlan = async (userId: string, planId: string, email: string) => {
    try {
      await setPlan.mutateAsync({ userId, planId });
      toast({ title: "Plano atualizado", description: `${email} agora está no plano ${planId}.` });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar plano", description: e.message, variant: "destructive" });
    }
  };

  const toggleAdmin = async (userId: string, enabled: boolean, email: string) => {
    try {
      await setSuperAdmin.mutateAsync({ userId, enabled });
      toast({
        title: enabled ? "Acesso de administrador concedido" : "Acesso de administrador removido",
        description: email,
      });
    } catch (e: any) {
      toast({ title: "Erro ao alterar permissão", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Gestão de contas
        </h1>
        <p className="text-muted-foreground text-sm">
          Libere ou remova o plano Pro e defina quem tem acesso administrativo.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((account) => {
            const isSelf = account.id === user?.id;
            return (
              <Card key={account.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    {account.name || "Sem nome"}
                    <span className="text-sm font-normal text-muted-foreground">{account.email}</span>
                    {account.is_super_admin && (
                      <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>
                    )}
                    <Badge variant={account.plan_id === "pro" ? "default" : "outline"}>
                      {account.plan_id === "pro" && <Crown className="h-3 w-3 mr-1" />}
                      {account.plan_id ?? "sem plano"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {plans?.map((plan) => (
                    <Button
                      key={plan.id}
                      size="sm"
                      variant={account.plan_id === plan.id ? "default" : "outline"}
                      disabled={account.plan_id === plan.id || setPlan.isPending}
                      onClick={() => changePlan(account.id, plan.id, account.email)}
                    >
                      {plan.id === "pro" ? "Liberar Pro" : `Mudar para ${plan.name}`}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSelf || setSuperAdmin.isPending}
                    onClick={() => toggleAdmin(account.id, !account.is_super_admin, account.email)}
                    title={isSelf ? "Você não pode alterar seu próprio acesso" : undefined}
                  >
                    {account.is_super_admin ? (
                      <><ShieldOff className="h-4 w-4 mr-1" /> Remover admin</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-1" /> Tornar admin</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma conta encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
