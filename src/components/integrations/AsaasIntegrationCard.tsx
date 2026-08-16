import { useState } from "react";
import { useAsaasConnection } from "@/hooks/useAsaasConnection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Copy, ExternalLink, RefreshCw, Key, ShieldCheck } from "lucide-react";

export function AsaasIntegrationCard() {
  const { connection, isLoading, connect, isConnecting, testConnection, isTesting, disconnect, isDisconnecting } = useAsaasConnection();
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const { toast } = useToast();

  const isConnected = connection?.status === "connected";
  const isError = connection?.status === "error";

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://lwabrwtqwveqrkwegikg.supabase.co"}/functions/v1/asaas-webhook`;

  const handleConnect = () => {
    if (!apiKey.trim()) {
      toast({ title: "API Key obrigatória", description: "Por favor insira a API Key do Asaas.", variant: "destructive" });
      return;
    }
    connect({ apiKey: apiKey.trim(), environment }, { onSuccess: () => setOpen(false) });
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Copiado!", description: "URL do Webhook copiada para a área de transferência." });
  };

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow relative flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center font-bold text-blue-600 text-lg">
                $
              </div>
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  Asaas Pagamentos
                  {connection?.environment === "sandbox" && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Sandbox
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">Pix, Boleto Bancário e Cartão de Crédito</p>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
            ) : isError ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Erro de Conexão
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Desconectado
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Gere cobranças individuais por cliente no Asaas. Sincronize cadastros e automatize a baixa financeira via Webhook em tempo real.
          </p>

          {isConnected && connection?.metadata?.last_balance !== undefined && (
            <div className="bg-muted/40 p-2.5 rounded-lg text-xs mb-4 flex items-center justify-between border border-border/40">
              <span className="text-muted-foreground">Saldo na conta Asaas:</span>
              <span className="font-semibold text-emerald-600">
                R$ {Number(connection.metadata.last_balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          {isConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="flex-1">
                Configurar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => testConnection()} disabled={isTesting} title="Testar Conexão">
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)} className="w-full">
              Conectar Asaas
            </Button>
          )}
        </div>
      </div>

      {/* Modal de Configuração */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-primary" /> Integração Asaas
            </DialogTitle>
            <DialogDescription>
              Insira sua API Key do Asaas para permitir a emissão automática de Pix, Boletos e Cartão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium">Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Ambiente de Testes)</SelectItem>
                  <SelectItem value="production">Produção (Conta Real)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">API Key do Asaas</Label>
              <Input
                type="password"
                placeholder="$aact_YTU5YTE0M2M6..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Obtenha em: Minha Conta &gt; Configurações da Conta &gt; Integracoes &gt; Chaves de API.
              </p>
            </div>

            {/* Webhook Info */}
            <div className="bg-muted/40 p-3 rounded-lg border border-border/50 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <ShieldCheck className="h-4 w-4" /> URL do Webhook (Notificações)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Cadastre essa URL no painel do Asaas (Configurações &gt; Webhooks) para dar baixa automática quando o pagamento for recebido.
              </p>
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-[10px] h-8 bg-background" />
                <Button size="sm" variant="outline" onClick={copyWebhook} className="h-8 px-2 shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnect(undefined, { onSuccess: () => setOpen(false) })}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Desconectar
              </Button>
            ) : <div />}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                {isConnected ? "Atualizar Chave" : "Salvar e Conectar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
