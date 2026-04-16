import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { Loader2, QrCode, FileText, CreditCard } from "lucide-react";
import type { PaymentMethod } from "@/types/payments";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClientId?: string;
  defaultBudgetId?: string;
  defaultDemandId?: string;
  defaultFinancialEntryId?: string;
  defaultAmount?: number;
  defaultDescription?: string;
}

export function CreateChargeDialog({
  open, onOpenChange, defaultClientId, defaultBudgetId, defaultDemandId,
  defaultFinancialEntryId, defaultAmount, defaultDescription,
}: Props) {
  const { createPix, createBoleto, createCard } = usePayments();
  const { clients } = useClients();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [form, setForm] = useState({
    client_id: defaultClientId || "",
    amount: defaultAmount ? String(defaultAmount) : "",
    description: defaultDescription || "",
    due_date: "",
    payer_email: "",
    payer_cpf: "",
    payer_first_name: "",
    payer_last_name: "",
    card_token: "",
    installments: "1",
  });

  const isPending = createPix.isPending || createBoleto.isPending || createCard.isPending;

  const handleSubmit = () => {
    if (!form.client_id || !form.amount || !form.description) return;

    const base = {
      client_id: form.client_id,
      amount: Number(form.amount),
      description: form.description,
      budget_id: defaultBudgetId,
      demand_id: defaultDemandId,
      financial_entry_id: defaultFinancialEntryId,
      due_date: form.due_date || undefined,
      payer_email: form.payer_email || undefined,
      payer_cpf: form.payer_cpf || undefined,
      payer_first_name: form.payer_first_name || undefined,
      payer_last_name: form.payer_last_name || undefined,
    };

    const onSuccess = () => onOpenChange(false);

    if (method === "pix") {
      createPix.mutate(base, { onSuccess });
    } else if (method === "boleto") {
      createBoleto.mutate(base, { onSuccess });
    } else {
      createCard.mutate({ ...base, token: form.card_token, installments: Number(form.installments) }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Cobrança</DialogTitle></DialogHeader>

        <Tabs value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
          <TabsList className="w-full">
            <TabsTrigger value="pix" className="flex-1"><QrCode className="h-3.5 w-3.5 mr-1.5" />Pix</TabsTrigger>
            <TabsTrigger value="boleto" className="flex-1"><FileText className="h-3.5 w-3.5 mr-1.5" />Boleto</TabsTrigger>
            <TabsTrigger value="card" className="flex-1"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Cartão</TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>

            <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email do pagador</Label><Input value={form.payer_email} onChange={e => setForm(f => ({ ...f, payer_email: e.target.value }))} /></div>
              <div><Label>CPF do pagador</Label><Input value={form.payer_cpf} onChange={e => setForm(f => ({ ...f, payer_cpf: e.target.value }))} placeholder="00000000000" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={form.payer_first_name} onChange={e => setForm(f => ({ ...f, payer_first_name: e.target.value }))} /></div>
              <div><Label>Sobrenome</Label><Input value={form.payer_last_name} onChange={e => setForm(f => ({ ...f, payer_last_name: e.target.value }))} /></div>
            </div>

            <TabsContent value="card" className="mt-0 space-y-3">
              <div><Label>Token do cartão *</Label><Input value={form.card_token} onChange={e => setForm(f => ({ ...f, card_token: e.target.value }))} placeholder="Token gerado pelo SDK" /></div>
              <div><Label>Parcelas</Label>
                <Select value={form.installments} onValueChange={v => setForm(f => ({ ...f, installments: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Gerar Cobrança
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
