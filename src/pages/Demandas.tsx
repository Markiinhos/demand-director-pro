import { useDemands, Demand } from "@/hooks/useDemands";
import { useClients } from "@/hooks/useClients";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LayoutGrid, List, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Database } from "@/integrations/supabase/types";

type DemandStatus = Database["public"]["Enums"]["demand_status"];
type DemandPriority = Database["public"]["Enums"]["demand_priority"];
type DemandType = Database["public"]["Enums"]["demand_type"];

const columns: { id: DemandStatus; label: string; color: string }[] = [
  { id: "pendente", label: "Pendente", color: "bg-kanban-pending" },
  { id: "em_andamento", label: "Em Andamento", color: "bg-kanban-progress" },
  { id: "revisao", label: "Revisão", color: "bg-kanban-review" },
  { id: "finalizado", label: "Finalizado", color: "bg-kanban-done" },
];

const priorityLabels: Record<DemandPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const priorityColors: Record<DemandPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/10 text-warning",
  alta: "bg-destructive/10 text-destructive",
  urgente: "bg-destructive text-destructive-foreground",
};

const typeLabels: Record<DemandType, string> = { post: "Post", logo: "Logo", banner: "Banner", personalizado: "Personalizado", outro: "Outro" };

const emptyForm = {
  title: "", description: "", type: "outro" as DemandType, client_id: "",
  priority: "media" as DemandPriority, due_date: "", assigned_to: null as string | null,
};

export default function Demandas() {
  const { demands, isLoading, create, update, remove } = useDemands();
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => { setEditingDemand(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: Demand) => {
    setEditingDemand(d);
    setForm({
      title: d.title, description: d.description || "", type: d.type,
      client_id: d.client_id, priority: d.priority, due_date: d.due_date,
      assigned_to: d.assigned_to,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.client_id || !form.due_date) return;
    if (editingDemand) {
      update.mutate({ id: editingDemand.id, ...form }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(form, { onSuccess: () => { setOpen(false); setForm(emptyForm); } });
    }
  };

  const moveCard = (id: string, newStatus: DemandStatus) => {
    update.mutate({ id, status: newStatus });
  };

  const isPending = create.isPending || update.isPending;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandas</h1>
          <p className="text-muted-foreground text-sm">{demands.length} demandas no total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setView("kanban")} className={`p-1.5 rounded-md transition-colors ${view === "kanban" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")} className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Nova Demanda</Button>
        </div>
      </div>

      {view === "kanban" ? (
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
                      const client = clients.find(c => c.id === d.client_id);
                      const isOverdue = d.status !== "finalizado" && new Date(d.due_date) < new Date();
                      return (
                        <motion.div key={d.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                          className={`kanban-card group ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
                          <div className="flex items-start justify-between mb-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[d.priority]}`}>{priorityLabels[d.priority]}</span>
                            <span className="text-[10px] text-muted-foreground">{typeLabels[d.type]}</span>
                          </div>
                          <p className="text-sm font-medium mb-1">{d.title}</p>
                          <p className="text-xs text-muted-foreground mb-2">{client?.name}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {isOverdue && "⚠ "}{new Date(d.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-muted"><Edit className="h-3 w-3" /></button>
                              <button onClick={() => setDeleteId(d.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="hidden group-hover:flex gap-1 mt-2 pt-2 border-t border-border/50">
                            {columns.filter(c => c.id !== col.id).map(target => (
                              <button key={target.id} onClick={() => moveCard(d.id, target.id)}
                                className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-accent transition-colors flex-1 text-center">{target.label}</button>
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
          <div className="grid grid-cols-[1fr_120px_100px_100px_80px_60px] gap-2 p-3 border-b border-border/50 text-xs font-medium text-muted-foreground">
            <span>Demanda</span><span>Cliente</span><span>Prioridade</span><span>Entrega</span><span>Status</span><span></span>
          </div>
          {demands.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(d => {
            const client = clients.find(c => c.id === d.client_id);
            const isOverdue = d.status !== "finalizado" && new Date(d.due_date) < new Date();
            const col = columns.find(c => c.id === d.status)!;
            return (
              <div key={d.id} className={`grid grid-cols-[1fr_120px_100px_100px_80px_60px] gap-2 p-3 border-b border-border/30 last:border-0 items-center text-sm hover:bg-muted/30 ${isOverdue ? "bg-destructive/5" : ""}`}>
                <div><p className="font-medium truncate">{d.title}</p><p className="text-xs text-muted-foreground">{typeLabels[d.type]}</p></div>
                <span className="text-xs truncate">{client?.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium w-fit ${priorityColors[d.priority]}`}>{priorityLabels[d.priority]}</span>
                <span className={`text-xs ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {isOverdue && "⚠ "}{new Date(d.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
                <Select value={d.status} onValueChange={v => moveCard(d.id, v as DemandStatus)}>
                  <SelectTrigger className="h-7 text-[10px] px-2 border-0 bg-muted/50">
                    <div className="flex items-center gap-1"><div className={`h-1.5 w-1.5 rounded-full ${col.color}`} /><SelectValue /></div>
                  </SelectTrigger>
                  <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteId(d.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDemand ? "Editar Demanda" : "Nova Demanda"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as DemandType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as DemandPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prazo *</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingDemand ? "Salvar" : "Criar Demanda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="Excluir demanda" description="Tem certeza? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={remove.isPending} />
    </div>
  );
}
