import { useState } from "react";
import { useAsaasCharges } from "@/hooks/useAsaasCharges";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, QrCode, FileText, CreditCard, DollarSign } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAsaasChargeDialog({ open, onOpenChange }: Props) {
  const { clients } = useClients();
  const { createCharge, isCreating } = useAsaasCharges();

  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !amount || !dueDate) return;

    createCharge(
      {
        client_id: clientId,
        amount: Number(amount),
        billing_type: billingType,
        due_date: dueDate,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setClientId("");
          setAmount("");
          setDescription("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" /> Nova Cobrança Asaas
          </DialogTitle>
          <DialogDescription>
            Gere cobranças em Pix, Boleto ou Cartão conectadas diretamente ao Asaas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {(c as any).cpf || (c as any).cnpj ? `(${ (c as any).cpf || (c as any).cnpj })` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Forma de Pagamento</Label>
              <Select value={billingType} onValueChange={(v) => setBillingType(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-emerald-500" /> Pix
                    </div>
                  </SelectItem>
                  <SelectItem value="BOLETO">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-amber-500" /> Boleto Bancário
                    </div>
                  </SelectItem>
                  <SelectItem value="CREDIT_CARD">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-blue-500" /> Cartão de Crédito
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="150,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Data de Vencimento *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Descrição / Observações</Label>
            <Textarea
              placeholder="Ex: Serviço de Design - Parcela 1/2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isCreating || !clientId || !amount}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Gerar Cobrança
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
