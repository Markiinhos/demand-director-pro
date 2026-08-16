/**
 * Utilitários de formatação, máscara e validação de documentos brasileiros.
 * CPF, CNPJ, telefone, CEP — com mascaramento seguro para exibição.
 */

// ─── Formatação (aplica máscara visual) ──────────────────────

/** Remove tudo que não é dígito */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata CPF: 123.456.789-00 */
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Formata CNPJ: 12.345.678/0001-00 */
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Formata telefone brasileiro: (11) 99999-9999 ou (11) 9999-9999 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

/** Formata CEP: 12345-678 */
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

// ─── Validação ────────────────────────────────────────────────

/** Valida CPF usando algorítmo de dígitos verificadores */
export function validateCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;

  // Rejeitar CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9))) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10))) return false;

  return true;
}

/** Valida CNPJ usando algorítmo de dígitos verificadores */
export function validateCNPJ(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;

  // Rejeitar CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (size: number): number => {
    const weights = size === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < size; i++) {
      sum += parseInt(digits.charAt(i)) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (calcDigit(12) !== parseInt(digits.charAt(12))) return false;
  if (calcDigit(13) !== parseInt(digits.charAt(13))) return false;

  return true;
}

// ─── Mascaramento para exibição segura ────────────────────────

/** Mascara CPF para exibição: ***.456.789-** */
export function maskCPF(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return "***.***.***-**";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** Mascara CNPJ para exibição: **.***.678/0001-** */
export function maskCNPJ(cnpj: string): string {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return "**.***.***/**-**";
  return `**.***. ${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
}

/** Mascara documento genérico (CPF ou CNPJ) para exibição */
export function maskDocument(doc: string): string {
  const digits = onlyDigits(doc);
  if (digits.length === 11) return maskCPF(doc);
  if (digits.length === 14) return maskCNPJ(doc);
  // Genérico: mostrar apenas últimos 4 dígitos
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/** Mascara RG para exibição: mostra apenas últimos 3 dígitos */
export function maskRG(rg: string): string {
  const clean = rg.replace(/[^\dXx]/g, "");
  if (clean.length < 4) return "***";
  return `${"*".repeat(clean.length - 3)}${clean.slice(-3)}`;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Retorna o label legível para o tipo de pessoa */
export function personTypeLabel(type: "fisica" | "juridica" | null | undefined): string {
  if (type === "fisica") return "Pessoa Física";
  if (type === "juridica") return "Pessoa Jurídica";
  return "Não definido";
}

/** Formata documento de acordo com o tipo */
export function formatDocument(value: string, type: "cpf" | "cnpj"): string {
  return type === "cpf" ? formatCPF(value) : formatCNPJ(value);
}

/** Valida documento de acordo com o tipo */
export function validateDocument(value: string, type: "cpf" | "cnpj"): boolean {
  return type === "cpf" ? validateCPF(value) : validateCNPJ(value);
}
