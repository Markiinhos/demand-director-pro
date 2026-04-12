import { useFinancial, FinancialEntry } from "@/hooks/useFinancial";
import { useClients } from "@/hooks/useClients";
import { useDemands } from "@/hooks/useDemands";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Database } from "@/integrations/supabase/types";

type FinancialStatus = Database["public"]["Enums"]["financial_status"];
type FinancialType = Database["public"]["Enums"]["financial_type"];

const statusMap: Record<FinancialStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pago: { label: "Pago", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
};

const emptyForm = {
  type: "entrada" as FinancialType, description: "", amount: "",
  category: "", client_id: "", demand_id: "", status: "pendente" as FinancialStatus, due_date: "",
};

export default function Financeiro() {
  const { entries, isLoading, create, update, remove } = useFinancial();
  const { clients } = useClients();
  const { demands } = useDemands();
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const paidIncome = entries.filter(t => t.type === "entrada" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const paidExpenses = entries.filter(t => t.type === "saida" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const pendingIncome = entries.filter(t => t.type === "entrada" && t.status === "pendente").reduce((s, t) => s + t.amount, 0);
    const overdueIncome = entries.filter(t => t.type === "entrada" && t.status === "pendente" && t.due_date && new Date(t.due_date) < new Date()).reduce((s, t) => s + t.amount, 0);
    return { paidIncome, paidExpenses, pendingIncome, overdueIncome, profit: paidIncome - paidExpenses };
  }, [entries]);

  const openCreate = () => { setEditingEntry(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (e: FinancialEntry) => {
    setEditingEntry(e);
    setForm({
      type: e.type, description: e.description, amount: String(e.amount),
      category: e.category || "", client_id: e.client_id || "", demand_id: e.demand_id || "",
      status: e.status, due_date: e.due_date || "",
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.description.trim() || !form.amount) return;
    const payload = {
      ...form,
      amount: Number(form.amount),
      client_id: form.client_id || null,
      demand_id: form.demand_id || null,
      due_date: form.due_date || null,
    };
    if (editingEntry) {
      update.mutate({ id: editingEntry.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); setForm(emptyForm); } });
    }
  };

  const togglePaid = (entry: FinancialEntry) => {
    update.mutate({
      id: entry.id,
      status: entry.status === "pago" ? "pendente" : "pago",
      paid_at: entry.status === "pago" ? null : new Date().toISOString(),
    });
  };

  const filterTx = (txs: FinancialEntry[]) => {
    if (!search) return txs;
    const q = search.toLowerCase();
    return txs.filter(t => t.description.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q));
  };

  const incomeEntries = filterTx(entries.filter(t => t.type === "entrada"));
  const expenseEntries = filterTx(entries.filter(t => t.type === "saida"));
  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
  const isPending = create.isPending || update.isPending;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Financeiro</h1><p className="text-muted-foreground text-sm">Controle de receitas e despesas</p></div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Nova Transação</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Receita", value: formatCurrency(stats.paidIncome), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" },
          { label: "Despesas", value: formatCurrency(stats.paidExpenses), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Lucro", value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit > 0 ? "text-success" : "text-destructive", bg: stats.profit > 0 ? "bg-success/10" : "bg-destructive/10" },
          { label: "A Receber", value: formatCurrency(stats.pendingIncome), icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
          { label: "Em Atraso", value: formatCurrency(stats.overdueIncome), icon: DollarSign, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <div className={`h-7 w-7 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..." className="pl-9" />
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Receitas ({incomeEntries.length})</TabsTrigger>
          <TabsTrigger value="expenses">Despesas ({expenseEntries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {incomeEntries.map(tx => {
              const client = clients.find(c => c.id === tx.client_id);
              const st = statusMap[tx.status];
              const isOverdue = tx.status === "pendente" && tx.due_date && new Date(tx.due_date) < new Date();
              return (
                <div key={tx.id} className={`flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {client?.name} • {tx.category}{tx.due_date ? ` • Venc: ${new Date(tx.due_date).toLocaleDateString("pt-BR")}` : ""}
                      {isOverdue && <span className="text-destructive font-medium"> • Atrasado</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-success">{formatCurrency(tx.amount)}</span>
                    <Badge variant={isOverdue ? "destructive" : st.variant} className="cursor-pointer" onClick={() => togglePaid(tx)}>
                      {isOverdue ? "Atrasado" : st.label}
                    </Badge>
                    <button onClick={() => openEdit(tx)} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteId(tx.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {expenseEntries.map(tx => {
              const st = statusMap[tx.status];
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.category}{tx.due_date ? ` • Venc: ${new Date(tx.due_date).toLocaleDateString("pt-BR")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-destructive">{formatCurrency(tx.amount)}</span>
                    <Badge variant={st.variant} className="cursor-pointer" onClick={() => togglePaid(tx)}>{st.label}</Badge>
                    <button onClick={() => openEdit(tx)} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteId(tx.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEntry ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as FinancialType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="entrada">Receita</SelectItem><SelectItem value="saida">Despesa</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Mensalidade, Projeto..." /></div>
            </div>
            {form.type === "entrada" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Demanda</Label>
                  <Select value={form.demand_id} onValueChange={v => setForm(f => ({ ...f, demand_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>{demands.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div><Label>Data de Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingEntry ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="Excluir lançamento" description="Tem certeza? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={remove.isPending} />
    </div>
  );
}
