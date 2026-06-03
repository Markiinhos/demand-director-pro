import { useState, useCallback } from "react";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare, CheckCircle2, AlertCircle, Loader2, Unlink,
  RefreshCw, Phone, Send, ShieldCheck, Copy, KeyRound, Building2, Calendar,
} from "lucide-react";
import { toast } from "sonner";

const META_APP_ID = import.meta.env.VITE_META_APP_ID || "";
const OAUTH_CALLBACK_REDIRECT_URI = "https://lwabrwtqwveqrkwegikg.supabase.co/functions/v1/whatsapp-connect";
const META_OAUTH_SCOPES = "business_management,whatsapp_business_management,whatsapp_business_messaging";

export function WhatsAppConnectionCard() {
  const {
    connection, isLoading, isConnected, templates,
    metaConfig, isMetaConfigLoading,
    startManualOAuth, disconnect, reconnect, testSend,
    validateManualCredentials, saveManualConnection,
  } = useWhatsAppConnection();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [mode, setMode] = useState<"oauth" | "manual">("oauth");
  const [manualToken, setManualToken] = useState("");
  const [manualWaba, setManualWaba] = useState("");
  const [manualNumbers, setManualNumbers] = useState<Awaited<ReturnType<typeof validateManualCredentials.mutateAsync>>>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>("");

  const activeMetaAppId = metaConfig?.appId || META_APP_ID;
  const isMetaReady = Boolean(metaConfig?.ready && activeMetaAppId);

  const handleManualOAuth = useCallback(() => {
    setConnectError(null);

    const appId = activeMetaAppId;

    if (!appId) {
      const msg = "META_APP_ID não está configurado.";
      toast.error(msg);
      console.error("[WhatsApp] oauth-manual-error: Missing META_APP_ID");
      setConnectError(msg);
      return;
    }

    // Intentionally no Meta JavaScript SDK for the authorization code.

    console.log("[WhatsApp] oauth-manual-start 🚀 Redirecting to Meta OAuth dialog");
    console.log("[WhatsApp] app_id:", appId);
    console.log("oauth_dialog_redirect_uri", OAUTH_CALLBACK_REDIRECT_URI);
    console.log("token_exchange_redirect_uri", OAUTH_CALLBACK_REDIRECT_URI);
    console.log("[WhatsApp] scope:", META_OAUTH_SCOPES);
    console.log("[WhatsApp] scope:", META_OAUTH_SCOPES);

    setIsConnecting(true);
    startManualOAuth.mutate(undefined, {
      onSuccess: ({ oauthUrl }) => {
        console.log("[WhatsApp] oauth_url:", oauthUrl);
        window.location.href = oauthUrl;
      },
      onError: (err) => {
        setIsConnecting(false);
        setConnectError(err.message);
      },
    });
  }, [activeMetaAppId, startManualOAuth]);

  const copyWebhookToken = () => {
    if (connection?.webhook_verify_token) {
      navigator.clipboard.writeText(connection.webhook_verify_token);
      toast.success("Verify Token copiado!");
    }
  };

  const statusConfig = {
    connected: { label: "Conectado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    disconnected: { label: "Desconectado", color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", icon: AlertCircle },
    error: { label: "Erro", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle },
  };

  const currentStatus = statusConfig[connection?.status as keyof typeof statusConfig] || statusConfig.disconnected;
  const StatusIcon = currentStatus.icon;
  const isBusy = isConnecting || startManualOAuth.isPending;

  const handleValidateManual = async () => {
    if (!manualToken.trim() || !manualWaba.trim()) {
      toast.error("Preencha Access Token e WABA ID");
      return;
    }
    try {
      const nums = await validateManualCredentials.mutateAsync({ accessToken: manualToken.trim(), wabaId: manualWaba.trim() });
      setManualNumbers(nums);
      const real = nums.filter(n => !n.is_test);
      if (real.length === 1) setSelectedNumberId(real[0].id);
      else setSelectedNumberId("");
      toast.success(`${nums.length} número(s) encontrado(s)`);
    } catch (_) { /* toast handled in hook */ }
  };

  const handleSaveManual = async () => {
    if (manualNumbers.length > 1 && !selectedNumberId) {
      toast.error("Selecione um número");
      return;
    }
    try {
      await saveManualConnection.mutateAsync({
        accessToken: manualToken.trim(),
        wabaId: manualWaba.trim(),
        phoneNumberId: selectedNumberId || manualNumbers[0]?.id,
      });
      setManualToken(""); setManualWaba(""); setManualNumbers([]); setSelectedNumberId("");
    } catch (_) { /* toast handled */ }
  };

  return (
    <div className="space-y-4">
      {/* ════ Main Connection Card ════ */}
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold">WhatsApp Business</h2>
              <p className="text-sm text-muted-foreground">
                Conecte seu WhatsApp Business para enviar cobranças, contratos, propostas e mensagens automáticas pelo seu próprio número.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="outline" className={`gap-1 shrink-0 ${currentStatus.color}`}>
              <StatusIcon className="h-3 w-3" />
              {currentStatus.label}
            </Badge>
          )}
        </div>

        {/* ──── Disconnected State ──── */}
        {!isConnected && connection?.status !== "error" && (
          <div className="space-y-4">
            {/* Mode switcher */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
              <button
                onClick={() => setMode("oauth")}
                className={`text-xs px-3 py-1.5 rounded-md transition ${mode === "oauth" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
              >
                Conectar com Meta (OAuth)
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`text-xs px-3 py-1.5 rounded-md transition ${mode === "manual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
              >
                Inserir credenciais manualmente
              </button>
            </div>

            {mode === "manual" && (
              <div className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/10">
                <div className="flex items-start gap-2">
                  <KeyRound className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    Use o <strong>Access Token permanente</strong> e o <strong>WhatsApp Business Account ID</strong> obtidos no
                    <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noreferrer" className="text-primary underline ml-1">Gerenciador da Meta</a>.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Access Token</Label>
                  <Input type="password" value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="EAAB..." className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">WhatsApp Business Account ID (WABA)</Label>
                  <Input value={manualWaba} onChange={e => setManualWaba(e.target.value)} placeholder="123456789012345" className="font-mono text-xs" />
                </div>

                {manualNumbers.length === 0 ? (
                  <Button onClick={handleValidateManual} disabled={validateManualCredentials.isPending} className="w-full">
                    {validateManualCredentials.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Validar credenciais e buscar números
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-xs">Selecione o número</Label>
                    <div className="space-y-2">
                      {manualNumbers.map(n => (
                        <label key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedNumberId === n.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"} ${n.is_test ? "opacity-50 cursor-not-allowed" : ""}`}>
                          <input
                            type="radio"
                            name="phone"
                            value={n.id}
                            checked={selectedNumberId === n.id}
                            onChange={() => !n.is_test && setSelectedNumberId(n.id)}
                            disabled={n.is_test}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{n.display_phone_number || "—"}</span>
                              {n.is_test && <Badge variant="destructive" className="text-[10px]">Número de teste</Badge>}
                              {n.quality_rating && <Badge variant="outline" className="text-[10px]">Qualidade: {n.quality_rating}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{n.verified_name || "Sem nome verificado"}</div>
                            {n.is_test && (
                              <div className="text-[10px] text-destructive mt-1">
                                Números de teste só enviam para destinatários pré-aprovados. Adicione um número real no Gerenciador da Meta.
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveManual} disabled={saveManualConnection.isPending || !selectedNumberId} className="flex-1">
                        {saveManualConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Conectar número selecionado
                      </Button>
                      <Button variant="outline" onClick={() => { setManualNumbers([]); setSelectedNumberId(""); }}>
                        Voltar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "oauth" && (
            <>
            {/* Main CTA */}
            <div className="bg-gradient-to-br from-emerald-500/5 via-emerald-500/[0.02] to-transparent border border-emerald-500/10 rounded-xl p-6 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">Conecte seu WhatsApp Business</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ao clicar, o fluxo oficial da Meta será aberto para conectar ou criar sua conta WhatsApp Business. Tudo é feito em alguns cliques, pela página oficial da Meta.
                </p>
              </div>

              {/* Error display */}
              {connectError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive text-left flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Erro ao conectar</p>
                    <p className="text-xs mt-0.5 opacity-90">{connectError}</p>
                  </div>
                </div>
              )}

              {isMetaReady ? (
                <Button
                  size="lg"
                  onClick={handleManualOAuth}
                  disabled={isBusy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.17-3.06.8.82-2.99-.19-.3A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
                    </svg>
                  )}
                  {isBusy ? "Conectando..." : "Conectar WhatsApp Business"}
                </Button>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-700 text-left space-y-2">
                  <strong>{isMetaConfigLoading ? "Verificando configuração da Meta..." : "⚠ Configuração necessária para OAuth Meta:"}</strong>
                  {!isMetaConfigLoading && (
                    <div className="space-y-2">
                      <p>Faltando: {metaConfig?.missing?.join(", ") || "diagnóstico indisponível"}.</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Frontend build: VITE_META_APP_ID {metaConfig?.hasFrontendAppId ? "ok" : "não encontrado"}.</li>
                        <li>Backend Edge Function: META_APP_ID/VITE_META_APP_ID {metaConfig?.hasBackendAppId ? "ok" : "não encontrado"}; META_APP_SECRET {metaConfig?.hasMetaAppSecret ? "ok" : "não encontrado"}.</li>
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-amber-600 mt-1">
                    O App ID pode vir do build do frontend ou do diagnóstico autenticado da Edge Function; o App Secret nunca é exposto ao navegador.
                  </p>
                </div>
              )}

              {isMetaReady && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>OAuth manual Meta pronto</span>
                  <span className="text-emerald-500 ml-1">
                    • App ID: {activeMetaAppId?.substring(0, 6)}...
                  </span>
                </div>
              )}

              {isMetaReady && (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-left text-[10px] text-muted-foreground">
                  <div className="font-mono break-all">oauth_dialog_redirect_uri={OAUTH_CALLBACK_REDIRECT_URI}</div>
                  <div className="font-mono break-all">token_exchange_redirect_uri={OAUTH_CALLBACK_REDIRECT_URI}</div>
                </div>
              )}

              {/* Steps preview */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground pt-1">
                {["Login Meta", "Criar/selecionar conta", "Verificar número", "Pronto!"].map(
                  (step, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-border">→</span>}
                      <span className="bg-muted/50 px-2 py-0.5 rounded-full">{step}</span>
                    </span>
                  )
                )}
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* ──── Error State ──── */}
        {connection?.status === "error" && (
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              A conexão apresentou um erro. Reconecte seu WhatsApp Business para normalizar.
            </div>
            <div className="flex gap-2">
              {isMetaReady && (
                <Button size="sm" onClick={handleManualOAuth} disabled={isBusy}>
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Reconectar via Meta
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => reconnect.mutate()} disabled={reconnect.isPending}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Tentar Novamente
              </Button>
            </div>
          </div>
        )}

        {/* ──── Connected State ──── */}
        {isConnected && connection && (
          <div className="space-y-4">
            {/* Connection details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Número:</span>
                <span className="font-medium">{connection.phone_number || "—"}</span>
              </div>
              {connection.display_name && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{connection.display_name}</span>
                </div>
              )}
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="text-muted-foreground">Conectado em:</span>
                <span>{new Date(connection.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            {/* Webhook info */}
            <div className="bg-muted/20 border border-border/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium">Webhook</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">URL:</span>
                  <code className="bg-background px-1.5 py-0.5 rounded text-[10px] break-all truncate">
                    {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`
                      );
                      toast.success("URL copiada!");
                    }}
                    className="text-primary hover:text-primary/80 shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Verify Token:</span>
                  <code className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono truncate">
                    {connection.webhook_verify_token?.substring(0, 16)}...
                  </code>
                  <button onClick={copyWebhookToken} className="text-primary hover:text-primary/80 shrink-0">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Templates ({templates.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map(t => (
                    <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testSend.mutate()}
                disabled={testSend.isPending}
              >
                {testSend.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Testar envio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reconnect.mutate()}
                disabled={reconnect.isPending}
              >
                {reconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Reconectar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
                Desconectar
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
