import { useBudgets } from "@/hooks/useBudgets";
import { useClients } from "@/hooks/useClients";
import { useState, useCallback } from "react";
import { Plus, Copy, Edit, Trash2, Loader2, Search, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Database } from "@/integrations/supabase/types";
import { exportBudgetPDF } from "@/lib/budgets/export-pdf";
import { PublicProposalButton } from "@/components/budgets/PublicProposalButton";
import { toast } from "sonner";

type BudgetStatus = Database["public"]["Enums"]["budget_status"];

const statusMap: Record<BudgetStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviado: { label: "Enviado", variant: "outline" },
  aprovado: { label: "Aprovado", variant: "default" },
  recusado: { label: "Recusado", variant: "destructive" },
  aceito: { label: "Aceito", variant: "default" },
};

interface ItemForm { title: string; description: string; quantity: number; unit_price: number; }
const emptyItem: ItemForm = { title: "", description: "", quantity: 1, unit_price: 0 };

export default function Orcamentos() {
  const { budgets, isLoading, create, update, remove, duplicate, getItems } = useBudgets();
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", notes: "", client_id: "", status: "rascunho" as BudgetStatus, valid_until: "" });
  const [items, setItems] = useState<ItemForm[]>([{ ...emptyItem }]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | BudgetStatus>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", description: "", notes: "", client_id: "", status: "rascunho", valid_until: "" });
    setItems([{ ...emptyItem }]);
    setOpen(true);
  };

  const openEdit = useCallback(async (id: string) => {
    const budget = budgets.find(b => b.id === id);
    if (!budget) return;
    setEditingId(id);
    setForm({
      title: budget.title, description: budget.description || "", notes: budget.notes || "",
      client_id: budget.client_id, status: budget.status, valid_until: budget.valid_until || "",
    });
    try {
      const budgetItems = await getItems(id);
      setItems(budgetItems.length > 0
        ? budgetItems.map(i => ({ title: i.title, description: i.description || "", quantity: i.quantity, unit_price: i.unit_price }))
        : [{ ...emptyItem }]
      );
    } catch {
      setItems([{ ...emptyItem }]);
    }
    setOpen(true);
  }, [budgets, getItems]);

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemForm, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleSubmit = () => {
    if (!form.title.trim() || !form.client_id || items.length === 0) return;
    if (items.some(i => !i.title.trim() || i.quantity <= 0 || i.unit_price <= 0)) return;

    const payload = {
      ...form,
      client_id: form.client_id,
      valid_until: form.valid_until || null,
      items: items.map(i => ({ title: i.title, description: i.description || null, quantity: i.quantity, unit_price: i.unit_price })),
    };

    if (editingId) {
      update.mutate({ id: editingId, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); } });
    }
  };

  const filtered = budgets.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const client = clients.find(c => c.id === b.client_id);
      return b.title.toLowerCase().includes(q) || (client?.name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
  const isPending = create.isPending || update.isPending;

  const handleExportPDF = async (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;
    const client = clients.find(c => c.id === budget.client_id);
    try {
      const items = await getItems(budgetId);
      if (items.length === 0) { toast.error("Orçamento sem itens para exportar"); return; }
      exportBudgetPDF({ budget, items, clientName: client?.name || "Cliente" });
      toast.success("PDF gerado com sucesso");
    } catch { toast.error("Erro ao gerar PDF"); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Orçamentos</h1><p className="text-muted-foreground text-sm">{budgets.length} orçamentos</p></div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Novo Orçamento</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "rascunho", "enviado", "aprovado", "recusado"] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            {f === "all" ? "Todos" : statusMap[f].label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar orçamento..." className="pl-9" />
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento encontrado</p>
        ) : filtered.map(budget => {
          const client = clients.find(c => c.id === budget.client_id);
          const st = statusMap[budget.status];
          return (
            <div key={budget.id} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{budget.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {client?.name}{budget.valid_until ? ` • Válido até ${new Date(budget.valid_until).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold">{formatCurrency(budget.total_amount)}</span>
                <Badge variant={st.variant}>{st.label}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => handleExportPDF(budget.id)} className="p-1.5 rounded hover:bg-muted" title="Exportar PDF"><Download className="h-3.5 w-3.5" /></button>
                  <PublicProposalButton budgetId={budget.id} currentSlug={(budget as any).public_slug ?? null} />
                  <button onClick={() => openEdit(budget.id)} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-3.5 w-3.5" /></button>
                  <button onClick={() => duplicate.mutate(budget.id)} className="p-1.5 rounded hover:bg-muted" title="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteId(budget.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as BudgetStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Validade</Label><Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Itens do Orçamento</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Adicionar Item</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-muted/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-destructive text-xs hover:underline">Remover</button>
                    )}
                  </div>
                  <div><Input placeholder="Nome do serviço *" value={item.title} onChange={e => updateItem(idx, "title", e.target.value)} /></div>
                  <Input placeholder="Descrição (opcional)" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Qtd</Label><Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} /></div>
                    <div><Label className="text-[10px]">Valor Unit.</Label><Input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", Number(e.target.value))} /></div>
                    <div><Label className="text-[10px]">Subtotal</Label><Input value={formatCurrency(item.quantity * item.unit_price)} disabled /></div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end p-3 bg-primary/5 rounded-lg">
                <span className="text-lg font-bold">Total: {formatCurrency(total)}</span>
              </div>
            </div>

            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingId ? "Salvar" : "Criar Orçamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="Excluir orçamento" description="Tem certeza? O orçamento e seus itens serão removidos permanentemente."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={remove.isPending} />
    </div>
  );
}
