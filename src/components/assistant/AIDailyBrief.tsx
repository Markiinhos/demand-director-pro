import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CalendarClock, Target, Wallet, Zap, Loader2 } from "lucide-react";
import AIActionCard from "./AIActionCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function AIDailyBrief() {
  const { data: brief, isLoading } = useQuery({
    queryKey: ["ai_daily_brief"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-daily-brief");
      if (error) throw error;
      return data;
    }
  });

  const { data: pendingActions, refetch: refetchActions } = useQuery({
    queryKey: ["ai_pending_actions_brief"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_actions")
        .select("*")
        .eq("status", "pending_approval")
        .limit(3);
      if (error) throw error;
      return data;
    }
  });

  const handleApprove = async (id: string, tool: string) => {
    // Edge function specifically for validation and approval
    const { error } = await supabase.from('ai_actions').update({ status: 'executed', executed_at: new Date().toISOString() }).eq('id', id);
    if (!error) refetchActions();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from('ai_actions').update({ status: 'rejected' }).eq('id', id);
    if (!error) refetchActions();
  };

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> Consultando Base de Dados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              Demandas Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brief?.overdue_demands || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requerem atenção</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <Target className="w-4 h-4" />
              Entregas Próximas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brief?.upcoming_demands || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Para os próximos 7 dias</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <CalendarClock className="w-4 h-4" />
              Ações Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brief?.pending_actions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes de aprovação</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
              Receita em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {brief?.overdue_financials_value?.toLocaleString('pt-BR') || '0,00'}</div>
            <p className="text-xs text-muted-foreground mt-1">{brief?.overdue_financials || 0} pagamentos atrasados</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Ações Sugeridas pelo Agente
        </h3>
        
        {(!pendingActions || pendingActions.length === 0) && (
          <div className="text-center text-muted-foreground bg-card border rounded-lg p-8">
            Nenhuma ação sensível (Alto Risco) pendente de aprovação no momento.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingActions?.map((action: any) => (
            <AIActionCard 
              key={action.id}
              title={`Ação: ${action.tool_name}`} 
              description={`Risco: ${action.risk_level === 'high' ? 'Alto' : 'Médio'}. Leia o json gerado na fila de Aprovações para mais detalhes.`}
              type={action.tool_name.includes('financial') ? 'finance' : 'general'}
              actionLabel="Aprovar/Executar"
              onApprove={() => handleApprove(action.id, action.tool_name)}
              onReject={() => handleReject(action.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
