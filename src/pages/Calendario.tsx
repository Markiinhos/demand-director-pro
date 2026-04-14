import { useMemo, useState } from "react";
import { useDemands } from "@/hooks/useDemands";
import { useFinancial } from "@/hooks/useFinancial";
import { useBudgets } from "@/hooks/useBudgets";
import { useClients } from "@/hooks/useClients";
import { ChevronLeft, ChevronRight, ListTodo, DollarSign, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EventType = "demanda" | "financeiro" | "orcamento" | "crm";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: EventType;
  subtitle?: string;
  isOverdue?: boolean;
}

const typeConfig: Record<EventType, { label: string; color: string; icon: any }> = {
  demanda: { label: "Demanda", color: "bg-info/10 text-info border-info/30", icon: ListTodo },
  financeiro: { label: "Financeiro", color: "bg-success/10 text-success border-success/30", icon: DollarSign },
  orcamento: { label: "Orçamento", color: "bg-warning/10 text-warning border-warning/30", icon: FileText },
  crm: { label: "CRM", color: "bg-violet-500/10 text-violet-600 border-violet-500/30", icon: Users },
};

export default function Calendario() {
  const { demands } = useDemands();
  const { entries } = useFinancial();
  const { budgets } = useBudgets();
  const { clients } = useClients();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<Set<EventType>>(new Set(["demanda", "financeiro", "orcamento", "crm"]));

  const toggleFilter = (type: EventType) => {
    setFilters(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    const today = new Date().toISOString().split("T")[0];

    if (filters.has("demanda")) {
      demands.forEach(d => {
        if (d.due_date) {
          const client = clients.find(c => c.id === d.client_id);
          result.push({
            id: `d-${d.id}`, title: d.title, date: d.due_date, type: "demanda",
            subtitle: client?.name, isOverdue: d.due_date < today && d.status !== "finalizado",
          });
        }
      });
    }
    if (filters.has("financeiro")) {
      entries.forEach(e => {
        if (e.due_date) {
          result.push({
            id: `f-${e.id}`, title: e.description, date: e.due_date, type: "financeiro",
            subtitle: `R$ ${e.amount.toLocaleString("pt-BR")}`, isOverdue: e.due_date < today && e.status !== "pago",
          });
        }
      });
    }
    if (filters.has("orcamento")) {
      budgets.forEach(b => {
        if (b.valid_until) {
          const client = clients.find(c => c.id === b.client_id);
          result.push({
            id: `b-${b.id}`, title: b.title, date: b.valid_until, type: "orcamento",
            subtitle: client?.name, isOverdue: b.valid_until < today && b.status !== "aprovado",
          });
        }
      });
    }
    if (filters.has("crm")) {
      clients.forEach(c => {
        if (c.next_action_date) {
          result.push({
            id: `c-${c.id}`, title: c.next_action || "Ação pendente", date: c.next_action_date, type: "crm",
            subtitle: c.name, isOverdue: c.next_action_date < today,
          });
        }
      });
    }
    return result;
  }, [demands, entries, budgets, clients, filters]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const days = useMemo(() => {
    const result: { day: number; dateStr: string; isToday: boolean; events: CalendarEvent[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push({
        day: d, dateStr, isToday: dateStr === todayStr,
        events: events.filter(e => e.date === dateStr),
      });
    }
    return result;
  }, [year, month, daysInMonth, events, todayStr]);

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));
  const monthName = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendário</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium capitalize min-w-[160px] text-center">{monthName}</span>
          <Button variant="outline" size="sm" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(Object.keys(typeConfig) as EventType[]).map(type => {
          const cfg = typeConfig[type];
          return (
            <button key={type} onClick={() => toggleFilter(type)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                filters.has(type) ? cfg.color : "bg-muted text-muted-foreground border-transparent opacity-50"
              }`}>
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/50">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
            <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border/30" />
          ))}
          {days.map(d => (
            <div key={d.day} className={`min-h-[100px] border-b border-r border-border/30 p-1.5 ${d.isToday ? "bg-primary/5" : ""}`}>
              <span className={`text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full ${d.isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{d.day}</span>
              <div className="space-y-0.5 mt-1">
                {d.events.slice(0, 3).map(ev => {
                  const cfg = typeConfig[ev.type];
                  return (
                    <div key={ev.id} className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium ${ev.isOverdue ? "bg-destructive/10 text-destructive" : cfg.color}`} title={`${ev.title} - ${ev.subtitle || ""}`}>
                      {ev.title}
                    </div>
                  );
                })}
                {d.events.length > 3 && <span className="text-[9px] text-muted-foreground">+{d.events.length - 3} mais</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day agenda below */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Eventos deste mês ({events.length})</h2>
        <div className="space-y-2">
          {events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20).map(ev => {
            const cfg = typeConfig[ev.type];
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-lg border ${ev.isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card"}`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${cfg.color}`}><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{ev.subtitle} • {new Date(ev.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
                {ev.isOverdue && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
