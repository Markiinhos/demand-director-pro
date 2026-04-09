import { useAgency } from "@/contexts/AgencyContext";
import { ListTodo, Users, AlertTriangle, Clock, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const priorityLabels: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', review: 'Revisão', done: 'Finalizado',
};

export default function Dashboard() {
  const { demands, clients, leads, transactions, team, interactions } = useAgency();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const paidIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const paidExpenses = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const pendingIncome = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + t.amount, 0);
    const overdueCount = demands.filter(d => d.status !== 'done' && new Date(d.dueDate) < new Date()).length;
    const activeLeads = leads.filter(l => l.stage !== 'closed' && l.stage !== 'lost').length;
    return { paidIncome, paidExpenses, profit: paidIncome - paidExpenses, pendingIncome, overdueCount, activeLeads };
  }, [demands, leads, transactions]);

  const activeDemands = demands.filter(d => d.status !== 'done');
  const overdueDemands = activeDemands.filter(d => new Date(d.dueDate) < new Date());
  const recentInteractions = [...interactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do seu negócio</p>
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita', value: formatCurrency(stats.paidIncome), icon: ArrowUpRight, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Despesas', value: formatCurrency(stats.paidExpenses), icon: ArrowDownRight, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Lucro', value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit > 0 ? 'text-success' : 'text-destructive', bg: stats.profit > 0 ? 'bg-success/10' : 'bg-destructive/10' },
          { label: 'A Receber', value: formatCurrency(stats.pendingIncome), icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="stat-card cursor-pointer" onClick={() => navigate('/financeiro')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Activity cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Demandas Ativas', value: activeDemands.length, icon: ListTodo, color: 'text-info', onClick: () => navigate('/demandas') },
          { label: 'Atrasadas', value: stats.overdueCount, icon: AlertTriangle, color: 'text-destructive', onClick: () => navigate('/prazos') },
          { label: 'Clientes Ativos', value: clients.filter(c => c.status === 'active' || c.status === 'recurring').length, icon: Users, color: 'text-primary', onClick: () => navigate('/clientes') },
          { label: 'Leads Ativos', value: stats.activeLeads, icon: TrendingUp, color: 'text-success', onClick: () => navigate('/pipeline') },
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Overdue / upcoming demands */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Próximas Entregas
            {overdueDemands.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold ml-auto">
                {overdueDemands.length} atrasadas
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {activeDemands
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .slice(0, 8)
              .map(d => {
                const client = clients.find(c => c.id === d.clientId);
                const assignee = team.find(t => t.id === d.assigneeId);
                const isOverdue = new Date(d.dueDate) < new Date();
                return (
                  <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${isOverdue ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/40 hover:bg-muted/60'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>
                          {priorityLabels[d.priority]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{client?.company} • {assignee?.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {statusLabels[d.status]}
                      </span>
                      <span className={`text-xs font-medium ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {new Date(d.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Recent interactions */}
        <div className="bg-card border border-border/50 rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Conversas Recentes
          </h2>
          <div className="space-y-3">
            {recentInteractions.map(int => {
              const isWhatsApp = int.channel === 'whatsapp';
              const relatedName = int.relatedTo === 'client'
                ? clients.find(c => c.id === int.relatedId)?.company
                : leads.find(l => l.id === int.relatedId)?.company;
              return (
                <div key={int.id} className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isWhatsApp ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                      {isWhatsApp ? 'WhatsApp' : 'Email'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {int.direction === 'inbound' ? '← Recebido' : '→ Enviado'}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(int.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{int.subject}</p>
                  <p className="text-xs text-muted-foreground">{relatedName} • {int.summary}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team workload */}
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Carga da Equipe</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {team.map(member => {
            const memberDemands = demands.filter(d => d.assigneeId === member.id && d.status !== 'done');
            const load = memberDemands.length;
            const maxLoad = 5;
            const pct = Math.min((load / maxLoad) * 100, 100);
            return (
              <div key={member.id} className="p-3 rounded-lg bg-muted/40">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground text-xs">{load} tarefas</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
