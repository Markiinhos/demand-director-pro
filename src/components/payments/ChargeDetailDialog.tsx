import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, XCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import type { PaymentCharge } from "@/types/payments";
import { statusLabels, statusColors, methodLabels } from "@/types/payments";

interface Props {
  charge: PaymentCharge | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChargeDetailDialog({ charge, open, onOpenChange }: Props) {
  const { cancelCharge } = usePayments();
  const { clients } = useClients();
  if (!charge) return null;

  const client = clients.find(c => c.id === charge.client_id);
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const canCancel = ["pending", "awaiting_payment", "in_process"].includes(charge.status);

  const copyPix = () => {
    if (charge.pix_copy_paste) {
      navigator.clipboard.writeText(charge.pix_copy_paste);
      toast.success("Código Pix copiado!");
    }
  };

  const copyLink = () => {
    if (charge.payment_link) {
      navigator.clipboard.writeText(charge.payment_link);
      toast.success("Link copiado!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Cobrança</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{fmt(charge.amount)}</p>
              <p className="text-sm text-muted-foreground">{charge.description}</p>
            </div>
            <div className="text-right space-y-1">
              <Badge variant={statusColors[charge.status] as "default" | "secondary" | "destructive"}>
                {statusLabels[charge.status]}
              </Badge>
              <p className="text-xs text-muted-foreground">{methodLabels[charge.payment_method]}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{client?.name || "—"}</span></div>
            <div><span className="text-muted-foreground">Criado:</span> <span>{new Date(charge.created_at).toLocaleDateString("pt-BR")}</span></div>
            {charge.due_date && <div><span className="text-muted-foreground">Vencimento:</span> <span>{new Date(charge.due_date).toLocaleDateString("pt-BR")}</span></div>}
            {charge.paid_at && <div><span className="text-muted-foreground">Pago em:</span> <span>{new Date(charge.paid_at).toLocaleDateString("pt-BR")}</span></div>}
            {charge.card_last4 && <div><span className="text-muted-foreground">Cartão:</span> <span>•••• {charge.card_last4}</span></div>}
            {charge.external_reference && <div><span className="text-muted-foreground">Ref:</span> <span className="text-xs">{charge.external_reference}</span></div>}
          </div>

          {/* PIX QR Code */}
          {charge.payment_method === "pix" && charge.pix_qr_code && (
            <div className="text-center space-y-2 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium">QR Code Pix</p>
              <img src={`data:image/png;base64,${charge.pix_qr_code}`} alt="QR Code Pix" className="mx-auto w-48 h-48 rounded" />
              {charge.pix_copy_paste && (
                <Button variant="outline" size="sm" onClick={copyPix}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar código Pix
                </Button>
              )}
            </div>
          )}

          {/* Boleto */}
          {charge.payment_method === "boleto" && charge.bank_slip_url && (
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Button variant="outline" onClick={() => window.open(charge.bank_slip_url!, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Abrir Boleto
              </Button>
            </div>
          )}

          {/* Link de pagamento (Checkout Pro) */}
          {charge.payment_method === "card" && charge.payment_link && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground break-all">{charge.payment_link}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar link
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(charge.payment_link!, "_blank")}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />Abrir
                </Button>
              </div>
            </div>
          )}

          {canCancel && (
            <Button variant="destructive" className="w-full" onClick={() => cancelCharge.mutate(charge.id, { onSuccess: () => onOpenChange(false) })} disabled={cancelCharge.isPending}>
              <XCircle className="h-4 w-4 mr-1.5" />Cancelar Cobrança
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
