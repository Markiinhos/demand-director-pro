import { useAgency } from "@/contexts/AgencyContext";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

export default function Prazos() {
  const { demands, clients, team } = useAgency();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const activeDemands = demands.filter(d => d.status !== 'done');
  const overdueDemands = activeDemands.filter(d => isBefore(parseISO(d.dueDate), new Date()));
  const upcomingDemands = activeDemands.filter(d => !isBefore(parseISO(d.dueDate), new Date()));

  const sortedDemands = [...activeDemands].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const getDayDemands = (day: Date) => demands.filter(d => isSameDay(parseISO(d.dueDate), day));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prazos</h1>
          <p className="text-muted-foreground text-sm">{activeDemands.length} entregas pendentes</p>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            Lista
          </button>
          <button onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            Calendário
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Atrasadas</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive">{overdueDemands.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Próximas</span>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="text-2xl font-bold">{upcomingDemands.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Finalizadas</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="text-2xl font-bold text-success">{demands.filter(d => d.status === 'done').length}</p>
        </motion.div>
      </div>

      {view === 'list' ? (
        <div className="space-y-4">
          {overdueDemands.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Atrasadas
              </h3>
              <div className="bg-card border border-destructive/20 rounded-xl overflow-hidden">
                {overdueDemands.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(d => {
                  const client = clients.find(c => c.id === d.clientId);
                  const assignee = team.find(t => t.id === d.assigneeId);
                  const daysLate = Math.ceil((new Date().getTime() - new Date(d.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={d.id} className="flex items-center justify-between p-3 border-b border-border/30 last:border-0 bg-destructive/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>
                          {d.priority === 'high' ? 'Alta' : d.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          <p className="text-xs text-muted-foreground">{client?.company} • {assignee?.name}</p>
                        </div>
                      </div>
                      <span className="text-xs text-destructive font-semibold shrink-0 ml-3">{daysLate}d atrasada</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Próximas Entregas
            </h3>
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              {upcomingDemands.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(d => {
                const client = clients.find(c => c.id === d.clientId);
                const assignee = team.find(t => t.id === d.assigneeId);
                const daysUntil = Math.ceil((new Date(d.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>
                        {d.priority === 'high' ? 'Alta' : d.priority === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{client?.company} • {assignee?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-xs font-medium ${daysUntil <= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `${daysUntil}d`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="text-sm px-2 py-1 rounded hover:bg-muted transition-colors">←</button>
            <h3 className="text-sm font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="text-sm px-2 py-1 rounded hover:bg-muted transition-colors">→</button>
          </div>
          <div className="grid grid-cols-7 gap-px">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {calDays.map(day => {
              const dayDemands = getDayDemands(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              return (
                <div key={day.toISOString()}
                  className={`min-h-[80px] p-1 rounded-lg border border-transparent ${isToday(day) ? 'bg-primary/5 border-primary/20' : ''} ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                  <span className={`text-[10px] font-medium ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayDemands.slice(0, 2).map(d => {
                    const isOverdue = d.status !== 'done' && isBefore(parseISO(d.dueDate), new Date());
                    return (
                      <div key={d.id} className={`text-[9px] px-1 py-0.5 rounded mt-0.5 truncate font-medium ${isOverdue ? 'bg-destructive/10 text-destructive' : d.status === 'done' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                        {d.title}
                      </div>
                    );
                  })}
                  {dayDemands.length > 2 && (
                    <span className="text-[9px] text-muted-foreground">+{dayDemands.length - 2}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
