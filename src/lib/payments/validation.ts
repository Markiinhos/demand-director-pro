import type { PaymentMethod } from "@/types/payments";

type ChargeClient = {
  name?: string | null;
  email?: string | null;
  contact_name?: string | null;
};

type ChargeFormValues = {
  client_id: string;
  amount: string;
  description: string;
  due_date: string;
  payer_email: string;
  payer_cpf: string;
  payer_first_name: string;
  payer_last_name: string;
  card_token: string;
  installments: string;
};

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function sanitizeCpf(value: unknown): string | undefined {
  const raw = safeTrim(value);
  if (!raw) return undefined;

  const digits = raw.replace(/\D/g, "");
  return digits || undefined;
}

export function isValidCpf(value?: string): boolean {
  if (!value || value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(value[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(value[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(value[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(value[10]);
}

export function isValidEmail(value?: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function splitFullName(fullName?: string) {
  const normalized = safeTrim(fullName);
  if (!normalized) return { firstName: undefined, lastName: undefined };

  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

export function resolveChargePayer(form: ChargeFormValues, client?: ChargeClient | null) {
  const fallbackName = safeTrim(client?.contact_name) ?? safeTrim(client?.name);
  const fallbackSplit = splitFullName(fallbackName);

  return {
    email: safeTrim(form.payer_email) ?? safeTrim(client?.email),
    cpf: sanitizeCpf(form.payer_cpf),
    firstName: safeTrim(form.payer_first_name) ?? fallbackSplit.firstName,
    lastName: safeTrim(form.payer_last_name) ?? fallbackSplit.lastName,
  };
}

export function validateChargeForm({
  method,
  form,
  client,
}: {
  method: PaymentMethod;
  form: ChargeFormValues;
  client?: ChargeClient | null;
}) {
  if (!form.client_id) return "Selecione um cliente antes de gerar a cobrança.";

  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    return "Informe um valor válido de pelo menos R$ 1,00.";
  }

  if (!safeTrim(form.description)) {
    return "Informe a descrição da cobrança.";
  }

  if (form.due_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date.trim())) {
    return "Data de vencimento inválida. Use o formato AAAA-MM-DD.";
  }

  const payer = resolveChargePayer(form, client);

  if (!payer.email) return "Informe um e-mail válido do pagador.";
  if (!isValidEmail(payer.email)) return "E-mail do pagador inválido.";
  if (!payer.firstName) return "Informe o nome do pagador.";
  if (!payer.lastName) return "Informe o sobrenome do pagador.";
  if (!payer.cpf) return "Informe o CPF do pagador.";
  if (!isValidCpf(payer.cpf)) return "CPF do pagador inválido.";

  if (method === "card" && !safeTrim(form.card_token)) {
    return "Informe o token do cartão antes de gerar a cobrança.";
  }

  return null;
}