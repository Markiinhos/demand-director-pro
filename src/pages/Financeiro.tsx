import { useAgency } from "@/contexts/AgencyContext";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Transaction, PaymentStatus } from "@/types/agency";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusMap: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: 'Pago', variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  overdue: { label: 'Atrasado', variant: 'destructive' },
};

export default function Financeiro() {
  const { transactions, setTransactions, clients, demands } = useAgency();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ type: 'income' as 'income' | 'expense', description: '', amount: '', category: '', clientId: '', demandId: '', status: 'pending' as PaymentStatus, dueDate: '' });

  const stats = useMemo(() => {
    const paidIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const paidExpenses = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const pendingIncome = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + t.amount, 0);
    const overdueIncome = transactions.filter(t => t.type === 'income' && t.status === 'pending' && new Date(t.dueDate) < new Date()).reduce((s, t) => s + t.amount, 0);
    return { paidIncome, paidExpenses, pendingIncome, overdueIncome, profit: paidIncome - paidExpenses };
  }, [transactions]);

  const handleCreate = () => {
    if (!form.description || !form.amount) return;
    const tx: Transaction = {
      id: Date.now().toString(),
      type: form.type, description: form.description,
      amount: Number(form.amount), category: form.category,
      clientId: form.clientId || undefined,
      demandId: form.demandId || undefined,
      status: form.status, dueDate: form.dueDate,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTransactions(prev => [...prev, tx]);
    setForm({ type: 'income', description: '', amount: '', category: '', clientId: '', demandId: '', status: 'pending', dueDate: '' });
    setOpen(false);
  };

  const togglePaid = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? {
      ...t,
      status: t.status === 'paid' ? 'pending' : 'paid',
      paidDate: t.status === 'paid' ? undefined : new Date().toISOString().split('T')[0],
    } : t));
  };

  const filterTx = (txs: Transaction[]) => {
    if (!search) return txs;
    const q = search.toLowerCase();
    return txs.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  };

  const incomeTransactions = filterTx(transactions.filter(t => t.type === 'income'));
  const expenseTransactions = filterTx(transactions.filter(t => t.type === 'expense'));
  const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Controle de receitas e despesas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />Nova Transação</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'income' | 'expense' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Mensalidade, Projeto..." /></div>
              </div>
              {form.type === 'income' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cliente</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Demanda</Label>
                    <Select value={form.demandId} onValueChange={v => setForm(f => ({ ...f, demandId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{demands.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div><Label>Data de Vencimento</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Receita', value: formatCurrency(stats.paidIncome), icon: ArrowUpRight, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Despesas', value: formatCurrency(stats.paidExpenses), icon: ArrowDownRight, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Lucro', value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit > 0 ? 'text-success' : 'text-destructive', bg: stats.profit > 0 ? 'bg-success/10' : 'bg-destructive/10' },
          { label: 'A Receber', value: formatCurrency(stats.pendingIncome), icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Em Atraso', value: formatCurrency(stats.overdueIncome), icon: DollarSign, color: 'text-destructive', bg: 'bg-destructive/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <div className={`h-7 w-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
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
          <TabsTrigger value="income">Receitas ({incomeTransactions.length})</TabsTrigger>
          <TabsTrigger value="expenses">Despesas ({expenseTransactions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {incomeTransactions.map(tx => {
              const client = clients.find(c => c.id === tx.clientId);
              const demand = demands.find(d => d.id === tx.demandId);
              const st = statusMap[tx.status];
              const isOverdue = tx.status === 'pending' && new Date(tx.dueDate) < new Date();
              return (
                <div key={tx.id} className={`flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors ${isOverdue ? 'bg-destructive/5' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {client?.company}{demand ? ` • ${demand.title}` : ''} • {tx.category} • Venc: {new Date(tx.dueDate).toLocaleDateString('pt-BR')}
                      {isOverdue && <span className="text-destructive font-medium"> • Atrasado</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-success">{formatCurrency(tx.amount)}</span>
                    <Badge variant={isOverdue ? 'destructive' : st.variant} className="cursor-pointer" onClick={() => togglePaid(tx.id)}>
                      {isOverdue ? 'Atrasado' : st.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {expenseTransactions.map(tx => {
              const st = statusMap[tx.status];
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.category} • Venc: {new Date(tx.dueDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-destructive">{formatCurrency(tx.amount)}</span>
                    <Badge variant={st.variant} className="cursor-pointer" onClick={() => togglePaid(tx.id)}>{st.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
