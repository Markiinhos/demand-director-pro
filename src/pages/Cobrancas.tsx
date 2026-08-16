import { useState } from "react";
import { Link } from "react-router-dom";
import { usePayments } from "@/hooks/usePayments";
import { useAsaasCharges } from "@/hooks/useAsaasCharges";
import { useClients } from "@/hooks/useClients";
import { useMpConnection } from "@/hooks/useMpConnection";
import { useAsaasConnection } from "@/hooks/useAsaasConnection";
import { CreateChargeDialog } from "@/components/payments/CreateChargeDialog";
import { CreateAsaasChargeDialog } from "@/components/payments/CreateAsaasChargeDialog";
import { ChargeDetailDialog } from "@/components/payments/ChargeDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, QrCode, FileText, Link2, AlertCircle, ExternalLink, CheckCircle2, DollarSign, CreditCard } from "lucide-react";
import type { PaymentCharge, PaymentMethod } from "@/types/payments";
import { statusLabels, statusColors, methodLabels } from "@/types/payments";

const methodIcons: Record<PaymentMethod, typeof QrCode> = { pix: QrCode, boleto: FileText, card: Link2 };

export default function Cobrancas() {
  const { charges: mpCharges, isLoading: mpLoading } = usePayments();
  const { charges: asaasCharges, isLoading: asaasLoading } = useAsaasCharges();
  const { clients } = useClients();
  const { status: mpStatus } = useMpConnection();
  const { connection: asaasConn } = useAsaasConnection();

  const [gatewayTab, setGatewayTab] = useState<"mp" | "asaas">("mp");
  const [mpCreateOpen, setMpCreateOpen] = useState(false);
  const [asaasCreateOpen, setAsaasCreateOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<PaymentCharge | null>(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const mpNotConnected = mpStatus.data && !mpStatus.data.connected;
  const asaasNotConnected = !asaasConn || asaasConn.status !== "connected";

  const filteredMp = mpCharges.filter((c) => {
    if (filterMethod !== "all" && c.payment_method !== filterMethod) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const client = clients.find((cl) => cl.id === c.client_id);
      return (c.description || "").toLowerCase().includes(q) || (client?.name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const filteredAsaas = asaasCharges.filter((c) => {
    if (filterMethod !== "all" && c.billing_type !== filterMethod.toUpperCase()) return false;
    if (filterStatus !== "all" && c.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      const client = clients.find((cl) => cl.id === c.client_id);
      return (c.description || "").toLowerCase().includes(q) || (client?.name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const isLoading = mpLoading || asaasLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cobranças</h1>
          <p className="text-muted-foreground text-sm">Gerencie cobranças em Pix, Boleto e Cartão de Crédito</p>
        </div>

        <div className="flex items-center gap-2">
          {gatewayTab === "mp" ? (
            <Button onClick={() => setMpCreateOpen(true)} disabled={!!mpNotConnected}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova Cobrança MP
            </Button>
          ) : (
            <Button onClick={() => setAsaasCreateOpen(true)} disabled={!!asaasNotConnected} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Nova Cobrança Asaas
            </Button>
          )}
        </div>
      </div>

      {/* Gateway Selector Tabs */}
      <Tabs value={gatewayTab} onValueChange={(v) => setGatewayTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="mp" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-sky-500" /> Mercado Pago ({mpCharges.length})
          </TabsTrigger>
          <TabsTrigger value="asaas" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" /> Asaas ({asaasCharges.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou descrição..." className="pl-9" />
            </div>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos métodos</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="card">Cartão / Link</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente / Aguardando</SelectItem>
                <SelectItem value="approved">Aprovado / Recebido</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="canceled">Cancelado / Estornado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="mp" className="m-0 space-y-4">
            {mpNotConnected && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Mercado Pago não conectado</p>
                  <p className="text-xs text-muted-foreground">Conecte sua conta do Mercado Pago para emitir cobranças diretas.</p>
                </div>
                <Button asChild size="sm">
                  <Link to="/integracoes">Conectar</Link>
                </Button>
              </div>
            )}

            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              {filteredMp.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma cobrança do Mercado Pago encontrada</p>
              ) : (
                filteredMp.map((c) => {
                  const client = clients.find((cl) => cl.id === c.client_id);
                  const Icon = methodIcons[c.payment_method] || QrCode;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCharge(c)}
                      className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-sky-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.description || "Cobrança Mercado Pago"}</p>
                          <p className="text-xs text-muted-foreground">
                            {client?.name || "—"} • {methodLabels[c.payment_method]} • {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{fmt(c.amount)}</span>
                        <Badge variant={statusColors[c.status] as any}>{statusLabels[c.status]}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="asaas" className="m-0 space-y-4">
            {asaasNotConnected && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Asaas não conectado</p>
                  <p className="text-xs text-muted-foreground">Insira sua API Key do Asaas para emitir e sincronizar cobranças.</p>
                </div>
                <Button asChild size="sm">
                  <Link to="/integracoes">Conectar Asaas</Link>
                </Button>
              </div>
            )}

            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              {filteredAsaas.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma cobrança do Asaas encontrada</p>
              ) : (
                filteredAsaas.map((c) => {
                  const client = clients.find((cl) => cl.id === c.client_id);
                  const isReceived = ["RECEIVED", "CONFIRMED"].includes(c.status);
                  const isOverdue = c.status === "OVERDUE";
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                          {c.billing_type === "PIX" ? (
                            <QrCode className="h-4 w-4 text-emerald-600" />
                          ) : c.billing_type === "BOLETO" ? (
                            <FileText className="h-4 w-4 text-amber-600" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.description || "Cobrança Asaas"}</p>
                          <p className="text-xs text-muted-foreground">
                            {client?.name || "—"} • {c.billing_type} • Vencimento: {new Date(c.due_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{fmt(c.amount)}</span>
                        {isReceived ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Pago</Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                        {c.invoice_url && (
                          <Button size="sm" variant="ghost" asChild className="h-8 w-8 p-0">
                            <a href={c.invoice_url} target="_blank" rel="noreferrer" title="Abrir Fatura Asaas">
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <CreateChargeDialog open={mpCreateOpen} onOpenChange={setMpCreateOpen} />
      <CreateAsaasChargeDialog open={asaasCreateOpen} onOpenChange={setAsaasCreateOpen} />
      <ChargeDetailDialog charge={selectedCharge} open={!!selectedCharge} onOpenChange={() => setSelectedCharge(null)} />
    </div>
  );
}
