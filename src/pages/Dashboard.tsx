import { useClients } from "@/hooks/useClients";
import { useDemands } from "@/hooks/useDemands";
import { useFinancial } from "@/hooks/useFinancial";
import { useBudgets } from "@/hooks/useBudgets";
import { ListTodo, Users, AlertTriangle, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="content-card p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="content-card p-5">
          <Skeleton className="h-5 w-36 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

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

  const demandsByStatus = useMemo(() => {
    const groups: Record<string, number> = {};
    demands.forEach(d => { groups[d.status] = (groups[d.status] || 0) + 1; });
    return Object.entries(groups).map(([k, v]) => ({ name: statusLabels[k as DemandStatus] ?? k, value: v }));
  }, [demands]);

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

  if (isLoading) return <DashboardSkeleton />;

  return (
    <motion.div className="space-y-6 max-w-7xl" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div className="flex flex-wrap items-end justify-between gap-3" variants={item}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do seu negócio</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
            <TabsTrigger value="90d">90 dias</TabsTrigger>
            <TabsTrigger value="12m">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Financial Cards */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={item}>
        {[
          { label: "Receita", value: formatCurrency(stats.paidIncome), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10", iconBg: "bg-success/10" },
          { label: "Despesas", value: formatCurrency(stats.paidExpenses), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10", iconBg: "bg-destructive/10" },
          { label: "Lucro", value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit > 0 ? "text-success" : "text-destructive", bg: stats.profit > 0 ? "bg-success/10" : "bg-destructive/10", iconBg: stats.profit > 0 ? "bg-success/10" : "bg-destructive/10" },
          { label: "A Receber", value: formatCurrency(stats.pendingIncome), icon: DollarSign, color: "text-warning", bg: "bg-warning/10", iconBg: "bg-warning/10" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            variants={item}
            className="stat-card cursor-pointer group"
            onClick={() => navigate("/financeiro")}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <div className={`h-9 w-9 rounded-xl ${s.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </div>
            <p className={`text-xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Activity Cards */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={item}>
        {[
          { label: "Demandas Ativas", value: activeDemands.length, icon: ListTodo, color: "text-info", bg: "bg-info/10", onClick: () => navigate("/demandas") },
          { label: "Atrasadas", value: stats.overdueCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", onClick: () => navigate("/demandas") },
          { label: "Clientes", value: clients.filter(c => c.status === "ativo").length, icon: Users, color: "text-primary", bg: "bg-primary/10", onClick: () => navigate("/clientes") },
          { label: "Orçamentos", value: budgets.filter(b => b.status === "enviado").length, icon: FileText, color: "text-warning", bg: "bg-warning/10", onClick: () => navigate("/orcamentos") },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={item}
            className="stat-card cursor-pointer group"
            onClick={s.onClick}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" variants={item}>
        <div className="content-card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4 text-sm">Receita vs Despesas</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border) / 0.5)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 20px -4px rgba(0,0,0,0.1)",
                    padding: "8px 12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="receita" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gReceita)" name="Receita" />
                <Area type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gDespesas)" name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="content-card p-5">
          <h2 className="font-semibold mb-4 text-sm">Demandas por status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={demandsByStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {demandsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border) / 0.5)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px -4px rgba(0,0,0,0.1)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Top Clients */}
      <motion.div className="content-card p-5" variants={item}>
        <h2 className="font-semibold mb-4 text-sm">Top clientes por demandas</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandsByClient} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border) / 0.5)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px -4px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} name="Demandas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Upcoming deliveries */}
      <motion.div className="content-card p-5" variants={item}>
        <h2 className="font-semibold mb-4 text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Próximas Entregas
          {stats.overdueCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold ml-auto">
              {stats.overdueCount} atrasadas
            </span>
          )}
        </h2>
        <div className="space-y-1.5">
          {activeDemands.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8).map(d => {
            const client = clients.find(c => c.id === d.client_id);
            const isOverdue = new Date(d.due_date) < new Date();
            return (
              <div
                key={d.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-150 ${isOverdue ? "bg-destructive/5 border border-destructive/15" : "hover:bg-muted/50"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColors[d.priority]}`}>{priorityLabels[d.priority]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{client?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">{statusLabels[d.status]}</span>
                  <span className={`text-xs font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                    {new Date(d.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              </div>
            );
          })}
          {activeDemands.length === 0 && (
            <div className="empty-state py-8">
              <ListTodo className="empty-state-icon" />
              <p className="empty-state-title">Nenhuma demanda ativa</p>
              <p className="empty-state-description">Crie sua primeira demanda para começar a acompanhar entregas.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
