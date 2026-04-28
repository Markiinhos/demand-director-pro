export type MercadoPagoEnvironment = "test" | "production" | "unknown";

export interface PaymentsBackendStatus {
  environment: MercadoPagoEnvironment;
  isReady: boolean;
  issues: string[];
  accessTokenConfigured: boolean;
  clientSecretConfigured: boolean;
}

export function validateMercadoPagoBackendStatus(backend: PaymentsBackendStatus) {
  if (!backend.isReady) {
    return backend.issues[0] ?? "Credenciais do Mercado Pago não configuradas.";
  }
  if (backend.environment === "unknown") {
    return "Não foi possível identificar o ambiente do Mercado Pago (test/production).";
  }
  return null;
}