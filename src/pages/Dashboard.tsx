import { useClients } from "@/hooks/useClients";
import { useDemands } from "@/hooks/useDemands";
import { useFinancial } from "@/hooks/useFinancial";
import { useBudgets } from "@/hooks/useBudgets";
import { ListTodo, Users, AlertTriangle, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type DemandPriority = Database["public"]["Enums"]["demand_priority"];
type DemandStatus = Database["public"]["Enums"]["demand_status"];

const priorityLabels: Record<DemandPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const priorityColors: Record<DemandPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/10 text-warning",
  alta: "bg-destructive/10 text-destructive",
  urgente: "bg-destructive text-destructive-foreground",
};
const statusLabels: Record<DemandStatus, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", revisao: "Revisão", finalizado: "Finalizado",
};

export default function Dashboard() {
  const { clients, isLoading: loadingClients } = useClients();
  const { demands, isLoading: loadingDemands } = useDemands();
  const { entries, isLoading: loadingFinancial } = useFinancial();
  const { budgets } = useBudgets();
  const navigate = useNavigate();

  const isLoading = loadingClients || loadingDemands || loadingFinancial;

  const stats = useMemo(() => {
    const paidIncome = entries.filter(t => t.type === "entrada" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const paidExpenses = entries.filter(t => t.type === "saida" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const pendingIncome = entries.filter(t => t.type === "entrada" && t.status === "pendente").reduce((s, t) => s + t.amount, 0);
    const overdueCount = demands.filter(d => d.status !== "finalizado" && new Date(d.due_date) < new Date()).length;
    return { paidIncome, paidExpenses, profit: paidIncome - paidExpenses, pendingIncome, overdueCount };
  }, [demands, entries]);

  const activeDemands = demands.filter(d => d.status !== "finalizado");
  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-muted-foreground text-sm">Visão geral do seu negócio</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita", value: formatCurrency(stats.paidIncome), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" },
          { label: "Despesas", value: formatCurrency(stats.paidExpenses), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Lucro", value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit > 0 ? "text-success" : "text-destructive", bg: stats.profit > 0 ? "bg-success/10" : "bg-destructive/10" },
          { label: "A Receber", value: formatCurrency(stats.pendingIncome), icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="stat-card cursor-pointer" onClick={() => navigate("/financeiro")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Demandas Ativas", value: activeDemands.length, icon: ListTodo, color: "text-info", onClick: () => navigate("/demandas") },
          { label: "Atrasadas", value: stats.overdueCount, icon: AlertTriangle, color: "text-destructive", onClick: () => navigate("/demandas") },
          { label: "Clientes", value: clients.filter(c => c.status === "ativo").length, icon: Users, color: "text-primary", onClick: () => navigate("/clientes") },
          { label: "Orçamentos", value: budgets.filter(b => b.status === "enviado").length, icon: FileText, color: "text-warning", onClick: () => navigate("/orcamentos") },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.06 }}
            className="stat-card cursor-pointer" onClick={s.onClick}>
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            <div className="flex items-center justify-between mt-1">
              <p className="text-2xl font-bold">{s.value}</p>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upcoming deliveries */}
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Próximas Entregas
          {stats.overdueCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold ml-auto">{stats.overdueCount} atrasadas</span>
          )}
        </h2>
        <div className="space-y-2">
          {activeDemands.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8).map(d => {
            const client = clients.find(c => c.id === d.client_id);
            const isOverdue = new Date(d.due_date) < new Date();
            return (
              <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg ${isOverdue ? "bg-destructive/5 border border-destructive/20" : "bg-muted/40 hover:bg-muted/60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>{priorityLabels[d.priority]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{client?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{statusLabels[d.status]}</span>
                  <span className={`text-xs font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                    {new Date(d.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              </div>
            );
          })}
          {activeDemands.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma demanda ativa</p>}
        </div>
      </div>
    </div>
  );
}
