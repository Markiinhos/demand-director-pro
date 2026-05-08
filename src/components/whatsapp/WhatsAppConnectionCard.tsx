import { useState, useEffect, useCallback, useRef } from "react";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, CheckCircle2, AlertCircle, Loader2, Unlink,
  RefreshCw, Phone, Send, ShieldCheck, Copy,
} from "lucide-react";
import { toast } from "sonner";

// ── Meta App Config ──────────────────────────────────────
const META_APP_ID = import.meta.env.VITE_META_APP_ID || "";
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || "";

// ── FB SDK Loader ────────────────────────────────────────
declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: Record<string, unknown>) => void;
      login: (
        cb: (response: FBLoginResponse) => void,
        opts: Record<string, unknown>
      ) => void;
    };
  }
}

interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
  };
  status: string;
}

function loadFacebookSDK(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // ── DIAGNÓSTICO: domínio que o Facebook SDK enxerga ──
    console.group("🔍 [FB SDK] Diagnóstico de domínio");
    console.log("window.location.origin :", window.location.origin);
    console.log("window.location.hostname:", window.location.hostname);
    console.log("window.location.href    :", window.location.href);
    console.log("document.domain         :", document.domain);
    console.log(
      "👉 Domínio para cadastrar na Meta (sem https:// e sem /):",
      window.location.hostname
    );
    console.groupEnd();

    if (window.FB) {
      resolve();
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: "v22.0",
      });
      console.log("✅ [FB SDK] Inicializado com sucesso no domínio:", window.location.hostname);
      resolve();
    };

    if (document.getElementById("facebook-jssdk")) {
      // Script tag exists but SDK not loaded yet — wait for init
      if (!window.FB) {
        const check = setInterval(() => {
          if (window.FB) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error("FB SDK timeout")); }, 10000);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });
}

// ═══════════════════════════════════════════════════════════
export function WhatsAppConnectionCard() {
  const {
    connection, isLoading, isConnected, templates,
    metaConfig, isMetaConfigLoading,
    connectViaEmbeddedSignup, disconnect, reconnect, testSend,
  } = useWhatsAppConnection();

  const [isConnecting, setIsConnecting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  // Ref to store session info from the postMessage listener
  const sessionInfoRef = useRef<{
    waba_id?: string;
    phone_number_id?: string;
  }>({});

  const activeMetaAppId = metaConfig?.appId || META_APP_ID;
  const activeMetaConfigId = metaConfig?.configId || META_CONFIG_ID;
  const isMetaReady = Boolean(metaConfig?.ready && activeMetaAppId && activeMetaConfigId);

  // ── Load Facebook SDK ──────────────────────────────────
  useEffect(() => {
    setSdkReady(false);
    if (!activeMetaAppId) return;
    loadFacebookSDK(activeMetaAppId)
      .then(() => setSdkReady(true))
      .catch(() => { /* SDK failed, user can use manual mode */ });
  }, [activeMetaAppId]);

  // ── Session Info Listener ──────────────────────────────
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        !event.origin?.endsWith("facebook.com") &&
        !event.origin?.endsWith("web.facebook.com")
      )
        return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH" && data.data) {
            sessionInfoRef.current = {
              waba_id: data.data.waba_id,
              phone_number_id: data.data.phone_number_id,
            };
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  // ── Launch Embedded Signup ─────────────────────────────
  const handleEmbeddedSignup = useCallback(() => {
    if (!window.FB) {
      toast.error("Facebook SDK não carregou. Tente recarregar a página.");
      return;
    }

    setIsConnecting(true);
    sessionInfoRef.current = {};

    const loginOptions: Record<string, unknown> = {
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: "",
        sessionInfoVersion: "3",
      },
    };

    // If config_id is set, use it (recommended by Meta)
    if (activeMetaConfigId) {
      loginOptions.config_id = activeMetaConfigId;
    } else {
      // Fallback: use scope-based signup
      loginOptions.scope =
        "business_management,whatsapp_business_management,whatsapp_business_messaging";
    }

    window.FB.login((response: FBLoginResponse) => {
      if (response.authResponse?.code) {
        const code = response.authResponse.code;
        const session = sessionInfoRef.current;

        connectViaEmbeddedSignup.mutate(
          {
            code,
            wabaId: session.waba_id,
            phoneNumberId: session.phone_number_id,
          },
          {
            onSettled: () => setIsConnecting(false),
          }
        );
      } else {
        setIsConnecting(false);
        // User cancelled — don't show error
        if (response.status !== "connected") {
          toast.info("Conexão cancelada.");
        }
      }
    }, loginOptions);
  }, [activeMetaConfigId, connectViaEmbeddedSignup]);

  const copyWebhookToken = () => {
    if (connection?.webhook_verify_token) {
      navigator.clipboard.writeText(connection.webhook_verify_token);
      toast.success("Verify Token copiado!");
    }
  };

  // ── Status config ──────────────────────────────────────
  const statusConfig = {
    connected: { label: "Conectado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    disconnected: { label: "Desconectado", color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", icon: AlertCircle },
    error: { label: "Erro", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle },
  };

  const currentStatus = statusConfig[connection?.status as keyof typeof statusConfig] || statusConfig.disconnected;
  const StatusIcon = currentStatus.icon;
  const isBusy = isConnecting || connectViaEmbeddedSignup.isPending;

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
            {/* Main CTA */}
            <div className="bg-gradient-to-br from-emerald-500/5 via-emerald-500/[0.02] to-transparent border border-emerald-500/10 rounded-xl p-6 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">Conecte seu WhatsApp Business</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ao clicar, você será direcionado para o fluxo oficial da Meta para conectar ou criar sua conta WhatsApp Business. Tudo é feito em alguns cliques.
                </p>
              </div>

              {isMetaReady ? (
                <Button
                  size="lg"
                  onClick={handleEmbeddedSignup}
                  disabled={isBusy || !sdkReady}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !sdkReady ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.17-3.06.8.82-2.99-.19-.3A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
                    </svg>
                  )}
                  {isBusy ? "Conectando..." : !sdkReady ? "Carregando SDK..." : "Conectar WhatsApp Business"}
                </Button>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-700 text-left space-y-2">
                  <strong>{isMetaConfigLoading ? "Verificando configuração da Meta..." : "⚠ Configuração necessária para Embedded Signup:"}</strong>
                  {!isMetaConfigLoading && (
                    <div className="space-y-2">
                      <p>Faltando: {metaConfig?.missing?.join(", ") || "diagnóstico indisponível"}.</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Frontend build: VITE_META_APP_ID {metaConfig?.hasFrontendAppId ? "ok" : "não encontrado"}; VITE_META_CONFIG_ID {metaConfig?.hasFrontendConfigId ? "ok" : "não encontrado"}.</li>
                        <li>Backend Edge Function: META_APP_ID/VITE_META_APP_ID {metaConfig?.hasBackendAppId ? "ok" : "não encontrado"}; VITE_META_CONFIG_ID {metaConfig?.hasBackendConfigId ? "ok" : "não encontrado"}; META_APP_SECRET {metaConfig?.hasMetaAppSecret ? "ok" : "não encontrado"}.</li>
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-amber-600 mt-1">
                    O App ID e Config ID podem vir do build do frontend ou do diagnóstico autenticado da Edge Function; o App Secret nunca é exposto ao navegador.
                  </p>
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
                <Button size="sm" onClick={handleEmbeddedSignup} disabled={isBusy}>
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
