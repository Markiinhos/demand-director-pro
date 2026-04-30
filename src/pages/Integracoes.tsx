import { useMpConnection } from "@/hooks/useMpConnection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

export default function Integracoes() {
  const { status, connect, disconnect } = useMpConnection();
  const s = status.data;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground text-sm">Conecte serviços externos à sua conta.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Mercado Pago</h2>
              <p className="text-sm text-muted-foreground">
                Conecte sua própria conta MP para receber Pix, boletos e cobranças via Checkout Pro diretamente no seu CNPJ/CPF.
              </p>
            </div>
          </div>
          {status.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : s?.connected ? (
            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Conectado</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />Não conectado</Badge>
          )}
        </div>

        {s?.connected && (
          <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 rounded-lg p-3">
            <div><span className="text-muted-foreground">Conta MP:</span> <span className="font-mono">{s.mp_user_id || "—"}</span></div>
            <div><span className="text-muted-foreground">Ambiente:</span> {s.live_mode ? "Produção" : "Teste"}</div>
            {s.connected_at && <div className="col-span-2"><span className="text-muted-foreground">Conectado em:</span> {new Date(s.connected_at).toLocaleString("pt-BR")}</div>}
          </div>
        )}

        {s && !s.oauthAppConfigured && (
          <p className="text-xs text-destructive">App OAuth do Mercado Pago não configurado no servidor (MP_CLIENT_ID/MP_CLIENT_SECRET).</p>
        )}
        {s && !s.webhookSecretConfigured && (
          <p className="text-xs text-amber-500">Webhook secret não configurado — pagamentos não serão confirmados automaticamente.</p>
        )}

        <div className="flex gap-2">
          {s?.connected ? (
            <>
              <Button variant="outline" onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Reconectar
              </Button>
              <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                {disconnect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Desconectar
              </Button>
            </>
          ) : (
            <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
              {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Conectar Mercado Pago
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5 opacity-60">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2">WhatsApp Business <Badge variant="secondary" className="text-[10px]">em breve</Badge></h2>
            <p className="text-sm text-muted-foreground">Cada usuário conecta o próprio número e envia mensagens, contratos e cobranças.</p>
          </div>
        </div>
      </div>
    </div>
  );
}