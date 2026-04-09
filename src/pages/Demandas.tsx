import { useAgency } from "@/contexts/AgencyContext";
import { DemandStatus, Demand, Priority } from "@/types/agency";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const columns: { id: DemandStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pendente', color: 'bg-kanban-pending' },
  { id: 'in_progress', label: 'Em Andamento', color: 'bg-kanban-progress' },
  { id: 'review', label: 'Revisão', color: 'bg-kanban-review' },
  { id: 'done', label: 'Finalizado', color: 'bg-kanban-done' },
];

const priorityLabels: Record<Priority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const priorityColors: Record<Priority, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

export default function Demandas() {
  const { demands, setDemands, clients, team } = useAgency();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [form, setForm] = useState({ title: '', type: '', clientId: '', assigneeId: '', priority: 'medium' as Priority, dueDate: '', notes: '' });

  const handleCreate = () => {
    if (!form.title || !form.clientId || !form.assigneeId) return;
    const newDemand: Demand = {
      id: Date.now().toString(),
      ...form,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDemands(prev => [...prev, newDemand]);
    setForm({ title: '', type: '', clientId: '', assigneeId: '', priority: 'medium', dueDate: '', notes: '' });
    setOpen(false);
  };

  const moveCard = (id: string, newStatus: DemandStatus) => {
    setDemands(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandas</h1>
          <p className="text-muted-foreground text-sm">{demands.length} demandas no total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setView('kanban')}
              className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" />Nova Demanda</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Demanda</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Tipo</Label><Input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="Post, Logo, Banner..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cliente</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Responsável</Label>
                    <Select value={form.assigneeId} onValueChange={v => setForm(f => ({ ...f, assigneeId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prioridade</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data de Entrega</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} className="w-full">Criar Demanda</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colDemands = demands.filter(d => d.status === col.id);
            return (
              <div key={col.id} className="kanban-column flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{colDemands.length}</span>
                </div>
                <div className="space-y-2.5 min-h-[200px]">
                  <AnimatePresence>
                    {colDemands.map(d => {
                      const client = clients.find(c => c.id === d.clientId);
                      const assignee = team.find(t => t.id === d.assigneeId);
                      const isOverdue = d.status !== 'done' && new Date(d.dueDate) < new Date();
                      return (
                        <motion.div
                          key={d.id} layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`kanban-card group ${isOverdue ? 'border-destructive/40 bg-destructive/5' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>
                              {priorityLabels[d.priority]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{d.type}</span>
                          </div>
                          <p className="text-sm font-medium mb-1">{d.title}</p>
                          <p className="text-xs text-muted-foreground mb-2">{client?.company}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{assignee?.name}</span>
                            <span className={`text-[10px] ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                              {isOverdue && '⚠ '}{new Date(d.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <div className="hidden group-hover:flex gap-1 mt-2 pt-2 border-t border-border/50">
                            {columns.filter(c => c.id !== col.id).map(target => (
                              <button key={target.id} onClick={() => moveCard(d.id, target.id)}
                                className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-accent transition-colors flex-1 text-center">
                                {target.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-2 p-3 border-b border-border/50 text-xs font-medium text-muted-foreground">
            <span>Demanda</span><span>Cliente</span><span>Responsável</span><span>Prioridade</span><span>Entrega</span><span>Status</span>
          </div>
          {demands.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(d => {
            const client = clients.find(c => c.id === d.clientId);
            const assignee = team.find(t => t.id === d.assigneeId);
            const isOverdue = d.status !== 'done' && new Date(d.dueDate) < new Date();
            const col = columns.find(c => c.id === d.status)!;
            return (
              <div key={d.id} className={`grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-2 p-3 border-b border-border/30 last:border-0 items-center text-sm hover:bg-muted/30 transition-colors ${isOverdue ? 'bg-destructive/5' : ''}`}>
                <div>
                  <p className="font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.type}</p>
                </div>
                <span className="text-xs truncate">{client?.company}</span>
                <span className="text-xs truncate">{assignee?.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium w-fit ${priorityColors[d.priority]}`}>{priorityLabels[d.priority]}</span>
                <span className={`text-xs ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {isOverdue && '⚠ '}{new Date(d.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                <Select value={d.status} onValueChange={v => moveCard(d.id, v as DemandStatus)}>
                  <SelectTrigger className="h-7 text-[10px] px-2 border-0 bg-muted/50">
                    <div className="flex items-center gap-1">
                      <div className={`h-1.5 w-1.5 rounded-full ${col.color}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
