import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMpConnection } from "@/hooks/useMpConnection";
import { CreditCard, CheckCircle2, AlertCircle, Copy, Key, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function MercadoPagoIntegrationCard() {
  const { status, connect, connectWithToken, disconnect } = useMpConnection();
  const s = status.data;

  const [openTokenDialog, setOpenTokenDialog] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://lwabrwtqwveqrkwegikg.supabase.co"}/functions/v1/payments/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do Webhook do Mercado Pago copiada!");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      toast.error("Insira o Access Token do Mercado Pago.");
      return;
    }

    connectWithToken.mutate(manualToken.trim(), {
      onSuccess: () => {
        setOpenTokenDialog(false);
        setManualToken("");
      },
    });
  };

  return (
    <Card className="border border-blue-500/20 shadow-md relative overflow-hidden bg-card hover:border-blue-500/40 transition-all">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-600" />
      <CardHeader className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Mercado Pago
                {status.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : s?.connected ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                    <AlertCircle className="h-3 w-3 mr-1" /> Não Conectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Receba pagamentos por Pix, Boleto e Cartão de Crédito via Checkout Pro diretamente no seu CNPJ/CPF.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {s?.connected && (
          <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Mercado Pago ID:</span>
              <span className="font-mono font-semibold">{s.mp_user_id || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Ambiente:</span>
              <span className="font-medium capitalize">{s.live_mode ? "Produção" : "Teste"}</span>
            </div>
            {s.connected_at && (
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-muted-foreground">Conectado em:</span>
                <span>{new Date(s.connected_at).toLocaleString("pt-BR")}</span>
              </div>
            )}
          </div>
        )}

        {/* Webhook Endpoint Box */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            URL do Webhook Mercado Pago (IPN / Notificações)
          </Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="text-xs font-mono bg-muted/30" />
            <Button size="icon" variant="outline" onClick={handleCopyWebhook} title="Copiar Webhook">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {s && !s.oauthAppConfigured && (
          <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
            ⚠️ App OAuth do servidor não configurado (MP_CLIENT_ID). Você pode conectar via <strong>Access Token Direto</strong> abaixo.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {s?.connected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Reconectar via OAuth
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Conectar via OAuth (1-Clique)
              </Button>

              <Dialog open={openTokenDialog} onOpenChange={setOpenTokenDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Key className="h-4 w-4 mr-1.5 text-blue-500" />
                    Inserir Access Token
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-blue-600">
                      <Key className="h-5 w-5" />
                      Conexão via Access Token Mercado Pago
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Insira o seu Access Token de Produção (`APP_USR-...`) ou Teste (`TEST-...`) do Painel de Devs do Mercado Pago.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Access Token Mercado Pago</Label>
                      <Input
                        type="password"
                        placeholder="Ex: APP_USR-1234567890..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                      />
                    </div>

                    <DialogFooter className="pt-2">
                      <Button type="button" variant="ghost" onClick={() => setOpenTokenDialog(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={connectWithToken.isPending}>
                        {connectWithToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                        Salvar & Validar Token
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
