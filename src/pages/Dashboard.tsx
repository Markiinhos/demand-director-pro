import { useClients } from "@/hooks/useClients";
import { useDemands } from "@/hooks/useDemands";
import { useFinancial } from "@/hooks/useFinancial";
import { useBudgets } from "@/hooks/useBudgets";
import { ListTodo, Users, AlertTriangle, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { format, startOfMonth, subDays, subMonths, eachMonthOfInterval, eachDayOfInterval, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

type Range = "30d" | "90d" | "12m";

export default function Dashboard() {
  const { clients, isLoading: loadingClients } = useClients();
  const { demands, isLoading: loadingDemands } = useDemands();
  const { entries, isLoading: loadingFinancial } = useFinancial();
  const { budgets } = useBudgets();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("30d");

  const isLoading = loadingClients || loadingDemands || loadingFinancial;

  const fromDate = useMemo(() => {
    const now = new Date();
    if (range === "30d") return subDays(now, 30);
    if (range === "90d") return subDays(now, 90);
    return subMonths(now, 12);
  }, [range]);

  const inRange = (iso?: string | null) => !!iso && isAfter(parseISO(iso), fromDate);

  const stats = useMemo(() => {
    const filteredEntries = entries.filter(t => inRange(t.paid_at) || inRange(t.created_at));
    const paidIncome = filteredEntries.filter(t => t.type === "entrada" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const paidExpenses = filteredEntries.filter(t => t.type === "saida" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const pendingIncome = entries.filter(t => t.type === "entrada" && t.status === "pendente").reduce((s, t) => s + t.amount, 0);
    const overdueCount = demands.filter(d => d.status !== "finalizado" && new Date(d.due_date) < new Date()).length;
    return { paidIncome, paidExpenses, profit: paidIncome - paidExpenses, pendingIncome, overdueCount };
  }, [demands, entries, fromDate]);

  // Revenue chart series
  const revenueSeries = useMemo(() => {
    const now = new Date();
    if (range === "12m") {
      const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: now });
      return months.map(m => {
        const label = format(m, "MMM/yy", { locale: ptBR });
        const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const filtered = entries.filter(e => e.paid_at && parseISO(e.paid_at) >= m && parseISO(e.paid_at) < next);
        const receita = filtered.filter(e => e.type === "entrada" && e.status === "pago").reduce((s, e) => s + e.amount, 0);
        const despesas = filtered.filter(e => e.type === "saida" && e.status === "pago").reduce((s, e) => s + e.amount, 0);
        return { label, receita, despesas, lucro: receita - despesas };
      });
    }
    const days = eachDayOfInterval({ start: fromDate, end: now });
    const step = range === "90d" ? 7 : 1;
    const buckets: { label: string; receita: number; despesas: number; lucro: number }[] = [];
    for (let i = 0; i < days.length; i += step) {
      const start = days[i];
      const end = days[Math.min(i + step - 1, days.length - 1)];
      const filtered = entries.filter(e => e.paid_at && parseISO(e.paid_at) >= start && parseISO(e.paid_at) <= end);
      const receita = filtered.filter(e => e.type === "entrada" && e.status === "pago").reduce((s, e) => s + e.amount, 0);
      const despesas = filtered.filter(e => e.type === "saida" && e.status === "pago").reduce((s, e) => s + e.amount, 0);
      buckets.push({ label: format(start, "dd/MM", { locale: ptBR }), receita, despesas, lucro: receita - despesas });
    }
    return buckets;
  }, [entries, range, fromDate]);

  // Demands by status (pie)
  const demandsByStatus = useMemo(() => {
    const groups: Record<string, number> = {};
    demands.forEach(d => { groups[d.status] = (groups[d.status] || 0) + 1; });
    return Object.entries(groups).map(([k, v]) => ({ name: statusLabels[k as DemandStatus] ?? k, value: v }));
  }, [demands]);

  // Demands per client (top 5)
  const demandsByClient = useMemo(() => {
    const map: Record<string, number> = {};
    demands.forEach(d => { map[d.client_id] = (map[d.client_id] || 0) + 1; });
    return Object.entries(map)
      .map(([id, count]) => ({ name: clients.find(c => c.id === id)?.name ?? "—", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [demands, clients]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--destructive))"];

  const activeDemands = demands.filter(d => d.status !== "finalizado");
  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu negócio</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
            <TabsTrigger value="90d">90 dias</TabsTrigger>
            <TabsTrigger value="12m">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-xl p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Receita vs Despesas</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="receita" stroke="hsl(var(--success))" fill="url(#gReceita)" name="Receita" />
                <Area type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" fill="url(#gDespesas)" name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Demandas por status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={demandsByStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {demandsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Top clientes por demandas</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandsByClient} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Demandas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
