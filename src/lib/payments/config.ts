export type MercadoPagoEnvironment = "test" | "production" | "unknown";

export interface MercadoPagoFrontendConfig {
  publicKey?: string;
  environment: MercadoPagoEnvironment;
  isProduction: boolean;
  isReady: boolean;
  issues: string[];
}

export interface PaymentsBackendStatus {
  environment: MercadoPagoEnvironment;
  isReady: boolean;
  issues: string[];
  accessTokenConfigured: boolean;
  clientSecretConfigured: boolean;
}

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function detectMercadoPagoEnvironmentFromCredential(value?: string): MercadoPagoEnvironment {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (!normalized) return "unknown";
  if (normalized.startsWith("TEST-")) return "test";
  if (normalized.startsWith("APP_USR-")) return "production";

  return "unknown";
}

export function getMercadoPagoFrontendConfig(): MercadoPagoFrontendConfig {
  const publicKey = safeTrim(import.meta.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY);
  const environment = detectMercadoPagoEnvironmentFromCredential(publicKey);
  const issues: string[] = [];

  if (!publicKey) {
    issues.push("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY não configurada.");
  } else if (environment === "unknown") {
    issues.push("A public key do Mercado Pago é inválida ou não permite identificar o ambiente.");
  }

  return {
    publicKey,
    environment,
    isProduction: environment === "production",
    isReady: issues.length === 0,
    issues,
  };
}

export function validateMercadoPagoConfigAlignment(
  frontend: MercadoPagoFrontendConfig,
  backend: PaymentsBackendStatus,
) {
  if (!frontend.isReady) {
    return frontend.issues[0] ?? "A configuração pública do Mercado Pago está incompleta.";
  }

  if (!backend.isReady) {
    return backend.issues[0] ?? "A configuração do backend do Mercado Pago está incompleta.";
  }

  if (frontend.environment === "unknown" || backend.environment === "unknown") {
    return "Não foi possível identificar o ambiente do Mercado Pago configurado na aplicação.";
  }

  if (frontend.environment !== backend.environment) {
    return "As credenciais do Mercado Pago estão inconsistentes entre teste e produção.";
  }

  return null;
}