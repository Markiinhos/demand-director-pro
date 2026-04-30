export type MercadoPagoEnvironment = "test" | "production" | "unknown";

export interface PaymentsBackendStatus {
  environment: MercadoPagoEnvironment;
  isReady: boolean;
  issues: string[];
  connected: boolean;
  mp_user_id: string | null;
  live_mode: boolean;
  scope: string | null;
  connected_at: string | null;
  expires_at: string | null;
  webhookSecretConfigured?: boolean;
  oauthAppConfigured?: boolean;
}

export function validateMercadoPagoBackendStatus(backend: PaymentsBackendStatus) {
  if (!backend.connected) {
    return "Conecte sua conta Mercado Pago em Configurações → Integrações antes de criar cobranças.";
  }
  if (!backend.isReady) {
    return backend.issues[0] ?? "Credenciais do Mercado Pago não configuradas.";
  }
  return null;
}