export type DocumentType = "CPF" | "CNPJ";
export type PayerType = "PF" | "PJ";

type ChargeClient = {
  name?: string | null;
  email?: string | null;
  contact_name?: string | null;
};

export type ChargeFormValues = {
  client_id: string;
  amount: string;
  description: string;
  due_date: string;
  payer_type: PayerType;
  payer_email: string;
  payer_document: string;
  payer_first_name: string;
  payer_last_name: string;
  payer_company_name: string;
};

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function onlyDigits(value: unknown): string | undefined {
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

export function isValidCnpj(value?: string): boolean {
  if (!value || value.length !== 14 || /^(\d)\1{13}$/.test(value)) return false;

  const calc = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(value[i]) * weights[i];
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calc(12) === Number(value[12]) && calc(13) === Number(value[13]);
}

export function detectDocumentType(digits?: string): DocumentType | null {
  if (!digits) return null;
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

export function maskDocument(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    // CPF mask: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  // CNPJ mask: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
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
  const documentDigits = onlyDigits(form.payer_document);
  const documentType: DocumentType =
    form.payer_type === "PJ" ? "CNPJ" : "CPF";

  return {
    type: form.payer_type,
    email: safeTrim(form.payer_email) ?? safeTrim(client?.email),
    document: documentDigits,
    documentType,
    firstName:
      form.payer_type === "PJ"
        ? safeTrim(form.payer_company_name) ?? safeTrim(client?.name)
        : safeTrim(form.payer_first_name) ?? fallbackSplit.firstName,
    lastName:
      form.payer_type === "PJ"
        ? "."
        : safeTrim(form.payer_last_name) ?? fallbackSplit.lastName,
    companyName:
      form.payer_type === "PJ"
        ? safeTrim(form.payer_company_name) ?? safeTrim(client?.name)
        : undefined,
  };
}

export function validateChargeForm({
  form,
  client,
}: {
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

  if (form.payer_type === "PJ") {
    if (!safeTrim(form.payer_company_name)) return "Informe a razão social da empresa.";
    if (!payer.document) return "Informe o CNPJ.";
    if (!isValidCnpj(payer.document)) return "CNPJ inválido.";
  } else {
    if (!payer.firstName || payer.firstName.length < 2) return "Informe o nome do pagador (mín. 2 caracteres).";
    if (!payer.lastName || payer.lastName.length < 2) return "Informe o sobrenome do pagador (mín. 2 caracteres).";
    if (!payer.document) return "Informe o CPF do pagador.";
    if (!isValidCpf(payer.document)) return "CPF inválido.";
  }

  return null;
}