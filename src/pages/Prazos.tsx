import { useMemo } from "react";
import { useDemands } from "@/hooks/useDemands";
import { useFinancial } from "@/hooks/useFinancial";
import { useBudgets } from "@/hooks/useBudgets";
import { useClients } from "@/hooks/useClients";
import { AlertTriangle, Clock, CalendarDays, ListTodo, DollarSign, FileText, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  type: "demanda" | "financeiro" | "orcamento" | "crm";
  status?: string;
  priority?: string;
  amount?: number;
  clientName?: string;
}

const typeIcons = { demanda: ListTodo, financeiro: DollarSign, orcamento: FileText, crm: Users };
const typeColors = {
  demanda: "bg-info/10 text-info",
  financeiro: "bg-success/10 text-success",
  orcamento: "bg-warning/10 text-warning",
  crm: "bg-violet-500/10 text-violet-600",
};

export default function Prazos() {
  const { demands, isLoading: dl } = useDemands();
  const { entries, isLoading: fl } = useFinancial();
  const { budgets, isLoading: bl } = useBudgets();
  const { clients, isLoading: cl } = useClients();

  const today = new Date().toISOString().split("T")[0];
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const items = useMemo<DeadlineItem[]>(() => {
    const result: DeadlineItem[] = [];

    demands.filter(d => d.status !== "finalizado" && d.due_date).forEach(d => {
      const client = clients.find(c => c.id === d.client_id);
      result.push({ id: `d-${d.id}`, title: d.title, date: d.due_date, type: "demanda", status: d.status, priority: d.priority, clientName: client?.name });
    });

    entries.filter(e => e.status !== "pago" && e.due_date).forEach(e => {
      const client = clients.find(c => c.id === e.client_id);
      result.push({ id: `f-${e.id}`, title: e.description, date: e.due_date!, type: "financeiro", status: e.status, amount: e.amount, clientName: client?.name });
    });

    budgets.filter(b => b.status !== "aprovado" && b.valid_until).forEach(b => {
      const client = clients.find(c => c.id === b.client_id);
      result.push({ id: `b-${b.id}`, title: b.title, date: b.valid_until!, type: "orcamento", status: b.status, amount: b.total_amount, clientName: client?.name });
    });

    clients.filter(c => c.next_action_date).forEach(c => {
      result.push({ id: `c-${c.id}`, title: c.next_action || "Ação pendente", date: c.next_action_date!, type: "crm", clientName: c.name });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [demands, entries, budgets, clients]);

  const overdue = items.filter(i => i.date < today);
  const dueToday = items.filter(i => i.date === today);
  const next7 = items.filter(i => i.date > today && i.date <= in7);
  const next30 = items.filter(i => i.date > in7 && i.date <= in30);

  if (dl || fl || bl || cl) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const Section = ({ title, icon: Icon, items, color }: { title: string; icon: any; items: DeadlineItem[]; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-4 w-4 ${color}`} />
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map(item => {
            const TypeIcon = typeIcons[item.type];
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:shadow-sm transition-shadow">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[item.type]}`}><TypeIcon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.clientName && `${item.clientName} • `}
                    {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    {item.amount ? ` • R$ ${item.amount.toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status && <Badge variant="outline" className="text-[10px]">{item.status}</Badge>}
                  {item.priority && <Badge variant={item.priority === "urgente" || item.priority === "alta" ? "destructive" : "secondary"} className="text-[10px]">{item.priority}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Prazos</h1>
        <p className="text-muted-foreground text-sm">Acompanhe tudo que precisa de atenção</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Atrasados", count: overdue.length, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
          { label: "Vence Hoje", count: dueToday.length, color: "text-warning", bg: "bg-warning/10", icon: Clock },
          { label: "Próximos 7 dias", count: next7.length, color: "text-info", bg: "bg-info/10", icon: CalendarDays },
          { label: "Próximos 30 dias", count: next30.length, color: "text-muted-foreground", bg: "bg-muted", icon: CalendarDays },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <div className={`h-7 w-7 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <Section title="Atrasados" icon={AlertTriangle} items={overdue} color="text-destructive" />
        <Section title="Vence Hoje" icon={Clock} items={dueToday} color="text-warning" />
        <Section title="Próximos 7 dias" icon={CalendarDays} items={next7} color="text-info" />
        <Section title="Próximos 30 dias" icon={CalendarDays} items={next30} color="text-muted-foreground" />
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum prazo pendente. Tudo em dia! 🎉</p>
        </div>
      )}
    </div>
  );
}
