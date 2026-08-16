import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMercadoLivreConnection } from "@/hooks/useMercadoLivreConnection";
import { useMercadoLivreOrders } from "@/hooks/useMercadoLivreOrders";
import { ShoppingBag, CheckCircle, AlertCircle, Copy, ExternalLink, RefreshCw, Key, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function MercadoLivreIntegrationCard() {
  const { connection, isLoading, connect, isConnecting, disconnect, isDisconnecting } = useMercadoLivreConnection();
  const { syncOrders, isSyncing } = useMercadoLivreOrders();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [redirectUri, setRedirectUri] = useState(window.location.origin + "/integracoes");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://lwabrwtqwveqrkwegikg.supabase.co"}/functions/v1/mercadolivre-webhook`;

  const isConnected = connection?.status === "connected";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL Copiada!",
      description: "Cole esta URL na configuração de Notificações/Webhooks do seu App no Mercado Livre.",
    });
  };

  const handleGenerateAuthUrl = () => {
    if (!appId.trim()) {
      toast({
        title: "App ID Obrigatório",
        description: "Preencha o App ID antes de gerar a URL de autorização.",
        variant: "destructive",
      });
      return;
    }
    const authUrl = `https://auth.mercadolibre.com.br/authorization?response_type=code&client_id=${appId.trim()}&redirect_uri=${encodeURIComponent(redirectUri.trim())}`;
    window.open(authUrl, "_blank");
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !clientSecret || !authorizationCode) {
      toast({
        title: "Campos Incompletos",
        description: "Preencha App ID, Client Secret e o Código de Autorização.",
        variant: "destructive",
      });
      return;
    }

    connect(
      {
        appId: appId.trim(),
        clientSecret: clientSecret.trim(),
        code: authorizationCode.trim(),
        redirectUri: redirectUri.trim(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setAuthorizationCode("");
        },
      }
    );
  };

  return (
    <Card className="border border-amber-500/20 shadow-md relative overflow-hidden bg-card hover:border-amber-500/40 transition-all">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600" />
      <CardHeader className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Mercado Livre
                {isConnected ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    <CheckCircle className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                    <AlertCircle className="h-3 w-3 mr-1" /> Não Conectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Importe vendas do Mercado Livre e crie demandas automaticamente no CRM.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConnected && connection && (
          <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Vendedor ML:</span>
              <span className="font-semibold">{connection.nickname || "Vendedor Conectado"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Seller ID:</span>
              <span className="font-mono text-[11px]">{connection.seller_id}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <span className="text-muted-foreground">Status do Token:</span>
              <span className="text-emerald-600 font-medium capitalize">{connection.status}</span>
            </div>
          </div>
        )}

        {/* Webhook Endpoint Box */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
            URL do Webhook Mercado Livre (Notificações)
          </Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="text-xs font-mono bg-muted/30" />
            <Button size="icon" variant="outline" onClick={handleCopyWebhook} title="Copiar Webhook">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                onClick={() => syncOrders({ createDemands: true })}
                disabled={isSyncing}
              >
                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Sincronizar Pedidos & Criar Demandas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
              >
                Desconectar
              </Button>
            </>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                  <Key className="h-4 w-4 mr-1.5" />
                  Conectar Mercado Livre
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <ShoppingBag className="h-5 w-5" />
                    Conexão com Mercado Livre
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Insira as credenciais do seu aplicativo cadastrado no Portal de Devs do Mercado Livre.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleConnect} className="space-y-4 py-2">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Passo a Passo:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                      <li>Crie um App no <a href="https://developers.mercadolibre.com.br/devcenter" target="_blank" rel="noreferrer" className="underline text-amber-600">Portal de Desenvolvedores ML</a>.</li>
                      <li>Defina o Redirect URI como: <span className="font-mono text-[10px] text-foreground">{redirectUri}</span></li>
                      <li>Preencha o App ID e Secret Key abaixo.</li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">App ID (Client ID)</Label>
                    <Input
                      placeholder="Ex: 1234567890123456"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Client Secret (Secret Key)</Label>
                    <Input
                      type="password"
                      placeholder="Sua chave secreta do aplicativo ML"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Redirect URI (URL de Redirecionamento)</Label>
                    <Input
                      value={redirectUri}
                      onChange={(e) => setRedirectUri(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="pt-2 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">1. Autorize a aplicação:</span>
                      <Button type="button" size="sm" variant="outline" onClick={handleGenerateAuthUrl}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir Autorização ML
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">2. Cole o Code recebido na URL final (parâmetro ?code=...)</Label>
                      <Input
                        placeholder="Ex: TG-64abcdef12345678..."
                        value={authorizationCode}
                        onChange={(e) => setAuthorizationCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" disabled={isConnecting}>
                      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Salvar & Conectar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
