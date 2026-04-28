import { useState } from "react";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { CreateChargeDialog } from "@/components/payments/CreateChargeDialog";
import { ChargeDetailDialog } from "@/components/payments/ChargeDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, QrCode, FileText, Link2 } from "lucide-react";
import type { PaymentCharge, PaymentMethod } from "@/types/payments";
import { statusLabels, statusColors, methodLabels } from "@/types/payments";

const methodIcons: Record<PaymentMethod, typeof QrCode> = { pix: QrCode, boleto: FileText, card: Link2 };

export default function Cobrancas() {
  const { charges, isLoading } = usePayments();
  const { clients } = useClients();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<PaymentCharge | null>(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = charges.filter(c => {
    if (filterMethod !== "all" && c.payment_method !== filterMethod) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const client = clients.find(cl => cl.id === c.client_id);
      return (c.description || "").toLowerCase().includes(q) || (client?.name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cobranças</h1>
          <p className="text-muted-foreground text-sm">Pix, boleto e link de pagamento via Mercado Pago</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Nova Cobrança</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos métodos</SelectItem>
            <SelectItem value="pix">Pix</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="card">Link</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="awaiting_payment">Aguardando</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma cobrança encontrada</p>
        ) : filtered.map(c => {
          const client = clients.find(cl => cl.id === c.client_id);
          const Icon = methodIcons[c.payment_method] || QrCode;
          return (
            <div key={c.id} onClick={() => setSelectedCharge(c)} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.description || "Cobrança"}</p>
                  <p className="text-xs text-muted-foreground">{client?.name || "—"} • {methodLabels[c.payment_method]} • {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold">{fmt(c.amount)}</span>
                <Badge variant={statusColors[c.status] as "default" | "secondary" | "destructive"}>
                  {statusLabels[c.status]}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      <CreateChargeDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ChargeDetailDialog charge={selectedCharge} open={!!selectedCharge} onOpenChange={() => setSelectedCharge(null)} />
    </div>
  );
}
