import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { Loader2, QrCode, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types/payments";
import {
  resolveChargePayer,
  validateChargeForm,
  maskDocument,
  isValidCpf,
  isValidCnpj,
  isValidEmail,
  onlyDigits,
  type ChargeFormValues,
  type PayerType,
} from "@/lib/payments/validation";

type DialogMethod = "pix" | "boleto" | "link";

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
  const { createPix, createBoleto, createPaymentLink } = usePayments();
  const { clients } = useClients();
  const [method, setMethod] = useState<DialogMethod>("pix");
  const [form, setForm] = useState<ChargeFormValues>({
    client_id: defaultClientId || "",
    amount: defaultAmount ? String(defaultAmount) : "",
    description: defaultDescription || "",
    due_date: "",
    payer_type: "PF",
    payer_email: "",
    payer_document: "",
    payer_first_name: "",
    payer_last_name: "",
    payer_company_name: "",
  });
  const [installments, setInstallments] = useState("12");

  const selectedClient = clients.find((c) => c.id === form.client_id);
  const docDigits = onlyDigits(form.payer_document) ?? "";
  const docValid = form.payer_type === "PJ" ? isValidCnpj(docDigits) : isValidCpf(docDigits);
  const docTouched = docDigits.length > 0;

  const emailValid = isValidEmail(form.payer_email);
  const emailTouched = form.payer_email.length > 0;

  const isPending = createPix.isPending || createBoleto.isPending || createPaymentLink.isPending;

  const fieldError = (cond: boolean, touched: boolean, msg: string) =>
    touched && !cond ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;

  const docPlaceholder = useMemo(
    () => (form.payer_type === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"),
    [form.payer_type],
  );

  const handleDocChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, form.payer_type === "PJ" ? 14 : 11);
    setForm((f) => ({ ...f, payer_document: maskDocument(digits) }));
  };

  const handleTypeChange = (val: PayerType) => {
    setForm((f) => ({ ...f, payer_type: val, payer_document: "" }));
  };

  const handleSubmit = () => {
    const validationError = validateChargeForm({ form, client: selectedClient });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const amount = Number(form.amount);
    const dueDate = form.due_date.trim();
    const payer = resolveChargePayer(form, selectedClient);

    const base = {
      client_id: form.client_id,
      amount,
      description: form.description.trim(),
      budget_id: defaultBudgetId,
      demand_id: defaultDemandId,
      financial_entry_id: defaultFinancialEntryId,
      due_date: dueDate || undefined,
      payer_type: payer.type,
      payer_email: payer.email,
      payer_document: payer.document,
      payer_first_name: payer.type === "PF" ? payer.firstName : undefined,
      payer_last_name: payer.type === "PF" ? payer.lastName : undefined,
      payer_company_name: payer.type === "PJ" ? payer.companyName : undefined,
    };

    const onSuccess = () => onOpenChange(false);

    if (method === "pix") {
      createPix.mutate(base, { onSuccess });
    } else if (method === "boleto") {
      createBoleto.mutate(base, { onSuccess });
    } else {
      createPaymentLink.mutate({ ...base, installments: Number(installments) || 12 }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Cobrança</DialogTitle></DialogHeader>

        <Tabs value={method} onValueChange={(v) => setMethod(v as DialogMethod)}>
          <TabsList className="w-full">
            <TabsTrigger value="pix" className="flex-1"><QrCode className="h-3.5 w-3.5 mr-1.5" />Pix</TabsTrigger>
            <TabsTrigger value="boleto" className="flex-1"><FileText className="h-3.5 w-3.5 mr-1.5" />Boleto</TabsTrigger>
            <TabsTrigger value="link" className="flex-1"><Link2 className="h-3.5 w-3.5 mr-1.5" />Link</TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" min={1} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="border-t border-border/50 pt-3 space-y-3">
              <Label>Tipo de pagador</Label>
              <RadioGroup
                value={form.payer_type}
                onValueChange={(v) => handleTypeChange(v as PayerType)}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PF" id="payer-pf" />
                  <Label htmlFor="payer-pf" className="font-normal cursor-pointer">Pessoa Física</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PJ" id="payer-pj" />
                  <Label htmlFor="payer-pj" className="font-normal cursor-pointer">Pessoa Jurídica</Label>
                </div>
              </RadioGroup>

              <div>
                <Label>Email do pagador *</Label>
                <Input
                  type="email"
                  value={form.payer_email}
                  onChange={(e) => setForm((f) => ({ ...f, payer_email: e.target.value }))}
                  className={emailTouched && !emailValid ? "border-destructive" : ""}
                />
                {fieldError(emailValid, emailTouched, "Informe um e-mail válido")}
              </div>

              <div>
                <Label>{form.payer_type === "PJ" ? "CNPJ *" : "CPF *"}</Label>
                <Input
                  inputMode="numeric"
                  value={form.payer_document}
                  onChange={(e) => handleDocChange(e.target.value)}
                  placeholder={docPlaceholder}
                  className={docTouched && !docValid ? "border-destructive" : ""}
                />
                {fieldError(docValid, docTouched, form.payer_type === "PJ" ? "CNPJ inválido" : "CPF inválido")}
              </div>

              {form.payer_type === "PF" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={form.payer_first_name} onChange={(e) => setForm((f) => ({ ...f, payer_first_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Sobrenome *</Label>
                    <Input value={form.payer_last_name} onChange={(e) => setForm((f) => ({ ...f, payer_last_name: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Razão social *</Label>
                  <Input value={form.payer_company_name} onChange={(e) => setForm((f) => ({ ...f, payer_company_name: e.target.value }))} />
                </div>
              )}
            </div>

            {method === "link" && (
              <div className="border-t border-border/50 pt-3">
                <Label>Máximo de parcelas (cartão)</Label>
                <Select value={installments} onValueChange={setInstallments}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  O cliente paga no ambiente do Mercado Pago (cartão, Pix ou boleto).
                </p>
              </div>
            )}

            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {method === "link" ? "Gerar Link de Pagamento" : "Gerar Cobrança"}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
