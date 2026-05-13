import { useState, useCallback, useEffect, useRef } from "react";
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
const REDIRECT_URI = "https://demand-director-pro.lovable.app/whatsapp/";

// ── Timeout for the Embedded Signup flow (ms) ────────────
const EMBEDDED_SIGNUP_TIMEOUT_MS = 20_000;

// ── Facebook SDK types ───────────────────────────────────
declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: FBLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
      getLoginStatus: (callback: (response: FBLoginResponse) => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type FBLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
    expiresIn?: number;
  } | null;
};

type EmbeddedSignupEvent = {
  type: string;
  event: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    current_step?: string;
  };
};

// ═══════════════════════════════════════════════════════════
export function WhatsAppConnectionCard() {
  const {
    connection, isLoading, isConnected, templates,
    metaConfig, isMetaConfigLoading,
    connectViaEmbeddedSignup, disconnect, reconnect, testSend,
  } = useWhatsAppConnection();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sdkScriptReady, setSdkScriptReady] = useState(false); // script loaded, window.FB exists
  const [sdkInitialized, setSdkInitialized] = useState(false); // FB.init() called successfully
  const sdkInitCalledRef = useRef(false); // prevent double FB.init()
  const embeddedSignupDataRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackFiredRef = useRef(false);

  const activeMetaAppId = metaConfig?.appId || META_APP_ID;
  const activeMetaConfigId = metaConfig?.configId || META_CONFIG_ID;
  const isMetaReady = Boolean(metaConfig?.ready && activeMetaAppId && activeMetaConfigId);

  // sdkLoaded = both script ready AND init called
  const sdkLoaded = sdkScriptReady && sdkInitialized;

  // ── Helper: reset loading state ────────────────────────
  const resetConnecting = useCallback((errorMsg?: string) => {
    setIsConnecting(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (errorMsg) {
      setConnectError(errorMsg);
      toast.error(errorMsg);
      console.error(`[WhatsApp] ❌ ${errorMsg}`);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── STEP 1: Load the Facebook SDK script (once) ────────
  useEffect(() => {
    // If script tag already exists
    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) {
        console.log("[WhatsApp] sdk-script-loaded (already present)");
        setSdkScriptReady(true);
      } else {
        console.log("[WhatsApp] SDK script tag exists but window.FB not yet available");
      }
      return;
    }

    // Define fbAsyncInit — called by the SDK when it's ready
    // This ONLY marks the script as ready, does NOT call FB.init()
    window.fbAsyncInit = () => {
      console.log("[WhatsApp] sdk-script-loaded ✅ fbAsyncInit fired, window.FB is now available");
      setSdkScriptReady(true);
    };

    // Inject the SDK script
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";

    script.onerror = (e) => {
      console.error("[WhatsApp] fb-init-error: Failed to load Facebook SDK script", e);
      toast.error("Falha ao carregar o Facebook SDK. Verifique sua conexão e bloqueadores de anúncios.");
    };

    document.body.appendChild(script);
    console.log("[WhatsApp] SDK script injected into DOM");
  }, []); // Only once — no dependencies

  // ── STEP 2: Call FB.init() when script ready + appId available ──
  useEffect(() => {
    // Need both: script loaded AND appId available
    if (!sdkScriptReady || !window.FB) {
      return;
    }

    if (!activeMetaAppId) {
      console.log("[WhatsApp] fb-init-start: SDK ready but no META_APP_ID yet, waiting...");
      console.log("[WhatsApp]   VITE_META_APP_ID:", META_APP_ID || "(vazio)");
      console.log("[WhatsApp]   metaConfig?.appId:", metaConfig?.appId || "(vazio)");
      return;
    }

    // Prevent double init
    if (sdkInitCalledRef.current) {
      console.log("[WhatsApp] FB.init() already called, skipping");
      return;
    }

    const FB_VERSION = "v22.0";

    console.log("[WhatsApp] ════════════════════════════════════");
    console.log("[WhatsApp] fb-init-start");
    console.log("[WhatsApp] META APP ID:", activeMetaAppId);
    console.log("[WhatsApp] FB VERSION:", FB_VERSION);
    console.log("[WhatsApp] ════════════════════════════════════");

    try {
      window.FB.init({
        appId: activeMetaAppId,
        cookie: true,
        xfbml: false,
        version: FB_VERSION,
      });

      sdkInitCalledRef.current = true;
      setSdkInitialized(true);
      console.log("[WhatsApp] fb-init-success ✅ FB.init() completed with version", FB_VERSION);
    } catch (err) {
      console.error("[WhatsApp] fb-init-error ❌ FB.init() threw:", err);
      toast.error("Erro ao inicializar o Facebook SDK: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [sdkScriptReady, activeMetaAppId, metaConfig?.appId]);

  // ── WA_EMBEDDED_SIGNUP message listener ────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Log ALL cross-origin messages for debugging (redact large payloads)
      const isFromFacebook =
        event.origin === "https://www.facebook.com" ||
        event.origin === "https://web.facebook.com";

      if (!isFromFacebook) {
        // Skip non-Facebook messages silently
        return;
      }

      // Log all Facebook messages
      console.log("[WhatsApp] wa-embedded-signup-message-received from:", event.origin, {
        dataType: typeof event.data,
        preview: typeof event.data === "string"
          ? event.data.substring(0, 200)
          : "(object)",
      });

      try {
        let data: EmbeddedSignupEvent | null = null;

        if (typeof event.data === "string") {
          try {
            data = JSON.parse(event.data);
          } catch {
            return; // Not JSON, ignore
          }
        } else if (typeof event.data === "object") {
          data = event.data;
        }

        if (!data || data.type !== "WA_EMBEDDED_SIGNUP") {
          console.log("[WhatsApp] Facebook message received but not WA_EMBEDDED_SIGNUP:", {
            type: data?.type,
            event: data?.event,
          });
          return;
        }

        console.log("[WhatsApp] 📨 WA_EMBEDDED_SIGNUP event received:", {
          event: data.event,
          current_step: data.data?.current_step,
          waba_id: data.data?.waba_id || "(not yet)",
          phone_number_id: data.data?.phone_number_id || "(not yet)",
        });

        // Capture waba_id and phone_number_id as they come in
        if (data.data?.waba_id) {
          embeddedSignupDataRef.current.wabaId = data.data.waba_id;
          console.log("[WhatsApp] ✅ Captured waba_id:", data.data.waba_id);
        }
        if (data.data?.phone_number_id) {
          embeddedSignupDataRef.current.phoneNumberId = data.data.phone_number_id;
          console.log("[WhatsApp] ✅ Captured phone_number_id:", data.data.phone_number_id);
        }

        // Log step progression
        if (data.event === "SETUP_COMPLETE" || data.event === "FINISH") {
          console.log("[WhatsApp] wa-embedded-signup-finished 🏁", embeddedSignupDataRef.current);
        } else if (data.event === "CANCEL") {
          console.log("[WhatsApp] wa-embedded-signup-canceled ❌ User cancelled Embedded Signup");
          resetConnecting("Fluxo cancelado pelo usuário.");
        } else if (data.event === "ERROR") {
          console.error("[WhatsApp] wa-embedded-signup-error:", data.data);
          resetConnecting("Erro no fluxo do Embedded Signup da Meta.");
        }
      } catch (err) {
        console.error("[WhatsApp] Error parsing Facebook message:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    console.log("[WhatsApp] WA_EMBEDDED_SIGNUP listener attached");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [resetConnecting]);

  // ── Launch Embedded Signup via FB.login() ──────────────
  const handleEmbeddedSignup = useCallback(() => {
    // Clear previous error
    setConnectError(null);
    callbackFiredRef.current = false;

    // ── Pre-flight checks ─────────────────────────────
    if (!window.FB) {
      const msg = "Facebook SDK não está carregado. Aguarde um momento e tente novamente.";
      toast.error(msg);
      console.error("[WhatsApp] fb-login-error: FB SDK not loaded. window.FB =", typeof window.FB);
      setConnectError(msg);
      return;
    }

    const appId = activeMetaAppId;
    const configId = activeMetaConfigId;

    if (!appId) {
      const msg = "VITE_META_APP_ID não está configurado. Defina no .env ou nas secrets do Supabase.";
      toast.error(msg);
      console.error("[WhatsApp] fb-login-error: Missing META_APP_ID");
      setConnectError(msg);
      return;
    }

    if (!configId) {
      const msg = "Configuration ID do Embedded Signup inválido ou não configurado.";
      toast.error(msg);
      console.error("[WhatsApp] fb-login-error: Missing META_CONFIG_ID");
      setConnectError(msg);
      return;
    }

    // Validate that config_id looks reasonable (should be numeric)
    if (!/^\d+$/.test(configId)) {
      const msg = `Configuration ID do Embedded Signup inválido ou não configurado. Valor recebido: "${configId.substring(0, 20)}..."`;
      toast.error(msg);
      console.error("[WhatsApp] fb-login-error: Invalid config_id format:", configId);
      setConnectError(msg);
      return;
    }

    // ── Pre-launch diagnostic logs ────────────────────
    console.log("[WhatsApp] ════════════════════════════════════");
    console.log("[WhatsApp] fb-login-start 🚀 Launching Embedded Signup via FB.login()");
    console.log("[WhatsApp] app_id:", appId);
    console.log("[WhatsApp] config_id:", configId);
    console.log("oauth_dialog_redirect_uri", REDIRECT_URI);
    console.log("[WhatsApp] redirect_uri enviado no FB.login:", REDIRECT_URI);
    console.log("Frontend redirect_uri:", REDIRECT_URI);
    console.log("[WhatsApp] response_type:", "code");
    console.log("[WhatsApp] override_default_response_type:", true);
    console.log("[WhatsApp] FB object exists:", Boolean(window.FB));
    console.log("[WhatsApp] FB.login type:", typeof window.FB?.login);
    console.log("[WhatsApp] ════════════════════════════════════");

    // Reset captured data
    embeddedSignupDataRef.current = {};
    setIsConnecting(true);

    // ── Set timeout to prevent infinite loading ──────
    timeoutRef.current = setTimeout(() => {
      if (!callbackFiredRef.current) {
        console.error("[WhatsApp] fb-login-error: TIMEOUT — FB.login callback did not fire within", EMBEDDED_SIGNUP_TIMEOUT_MS / 1000, "seconds");
        console.error("[WhatsApp] This usually means:");
        console.error("[WhatsApp]   1. The popup was blocked by the browser");
        console.error("[WhatsApp]   2. The user closed the popup before completing");
        console.error("[WhatsApp]   3. The Facebook SDK failed to open the dialog");
        console.error("[WhatsApp]   4. config_id is invalid");

        resetConnecting(
          "O navegador pode ter bloqueado o popup da Meta, ou o fluxo não foi iniciado. " +
          "Permita popups para este site e tente novamente."
        );
      }
    }, EMBEDDED_SIGNUP_TIMEOUT_MS);

    // ── Call FB.login ─────────────────────────────────
    try {
      console.log("[WhatsApp] fb-login-start: Invoking window.FB.login() NOW...");

      window.FB.login(
        (response: FBLoginResponse) => {
          callbackFiredRef.current = true;

          // Clear the timeout since callback was called
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          console.log("[WhatsApp] fb-login-response:", {
            status: response.status,
            hasAuthResponse: Boolean(response.authResponse),
            hasCode: Boolean(response.authResponse?.code),
            hasAccessToken: Boolean(response.authResponse?.accessToken),
            userID: response.authResponse?.userID || "(none)",
          });

          // Log raw response for debugging
          console.log("[WhatsApp] fb-login-response (raw):", JSON.stringify(response));

          if (response.authResponse?.code) {
            const code = response.authResponse.code;
            const capturedData = embeddedSignupDataRef.current;

            console.log("[WhatsApp] code-received ✅ Authorization code received!", {
              codeLength: code.length,
              codePrefix: code.substring(0, 8) + "...",
              captured_waba_id: capturedData.wabaId || "(none)",
              captured_phone_number_id: capturedData.phoneNumberId || "(none)",
            });

            // Send code + captured IDs + redirect_uri to backend
            console.log("[WhatsApp] connect-edge-function-called: Sending code to backend...", {
              redirectUri: REDIRECT_URI,
            });

            connectViaEmbeddedSignup.mutate(
              {
                code,
                wabaId: capturedData.wabaId,
                phoneNumberId: capturedData.phoneNumberId,
              },
              {
                onSuccess: (data) => {
                  console.log("[WhatsApp] connect-edge-function-success:", data);
                  setIsConnecting(false);
                  setConnectError(null);
                },
                onError: (err) => {
                  console.error("[WhatsApp] connect-edge-function-error:", err.message);
                  resetConnecting("Erro ao conectar: " + err.message);
                },
              }
            );
          } else {
            // No authorization code
            console.warn("[WhatsApp] fb-login-error: No authorization code received.", {
              status: response.status,
              authResponse: response.authResponse,
            });

            if (response.status === "unknown") {
              resetConnecting(
                "Conexão cancelada ou popup foi fechado antes de completar o fluxo."
              );
            } else {
              resetConnecting(
                "Não foi possível obter o código de autorização da Meta."
              );
            }
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          redirect_uri: REDIRECT_URI,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: "3",
          },
        }
      );

      console.log("[WhatsApp] fb-login-called: window.FB.login() was invoked (popup should appear now)");

    } catch (err) {
      console.error("[WhatsApp] fb-login-error: Exception during FB.login():", err);
      resetConnecting(
        "Erro ao abrir o fluxo da Meta: " + (err instanceof Error ? err.message : String(err))
      );
    }
  }, [activeMetaAppId, activeMetaConfigId, connectViaEmbeddedSignup, resetConnecting]);

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
                  Ao clicar, o fluxo oficial da Meta será aberto para conectar ou criar sua conta WhatsApp Business. Tudo é feito em alguns cliques, sem sair da página.
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
                  onClick={handleEmbeddedSignup}
                  disabled={isBusy || !sdkLoaded}
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
                  {isBusy
                    ? "Conectando..."
                    : !sdkLoaded
                      ? "Carregando SDK..."
                      : "Conectar WhatsApp Business"}
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

              {/* SDK status indicator */}
              {isMetaReady && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${sdkLoaded ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                  <span>{sdkLoaded ? "Facebook SDK pronto" : "Carregando Facebook SDK..."}</span>
                  {sdkLoaded && (
                    <span className="text-emerald-500 ml-1">
                      • App ID: {activeMetaAppId?.substring(0, 6)}... • Config ID: {activeMetaConfigId?.substring(0, 6)}...
                    </span>
                  )}
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
                <Button size="sm" onClick={handleEmbeddedSignup} disabled={isBusy || !sdkLoaded}>
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
