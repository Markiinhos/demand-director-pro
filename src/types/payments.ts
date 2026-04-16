export type PaymentMethod = "pix" | "boleto" | "card";

export type PaymentStatus =
  | "pending"
  | "awaiting_payment"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "canceled"
  | "refunded"
  | "charged_back"
  | "expired"
  | "failed";

export interface PaymentCharge {
  id: string;
  user_id: string;
  client_id: string;
  budget_id: string | null;
  demand_id: string | null;
  financial_entry_id: string | null;
  provider: string;
  provider_charge_id: string | null;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  description: string | null;
  due_date: string | null;
  payment_link: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  card_last4: string | null;
  paid_at: string | null;
  external_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePixPayload {
  client_id: string;
  amount: number;
  description: string;
  budget_id?: string;
  demand_id?: string;
  financial_entry_id?: string;
  due_date?: string;
  payer_email?: string;
  payer_first_name?: string;
  payer_last_name?: string;
  payer_cpf?: string;
}

export interface CreateBoletoPayload {
  client_id: string;
  amount: number;
  description: string;
  budget_id?: string;
  demand_id?: string;
  financial_entry_id?: string;
  due_date?: string;
  payer_email?: string;
  payer_first_name?: string;
  payer_last_name?: string;
  payer_cpf?: string;
}

export interface CreateCardPayload {
  client_id: string;
  amount: number;
  description: string;
  budget_id?: string;
  demand_id?: string;
  financial_entry_id?: string;
  token: string;
  installments?: number;
  payer_email?: string;
  payer_cpf?: string;
  payment_method_id?: string;
}

export const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguardando Pagamento",
  approved: "Aprovado",
  authorized: "Autorizado",
  in_process: "Processando",
  in_mediation: "Em Mediação",
  rejected: "Rejeitado",
  canceled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Estornado",
  expired: "Expirado",
  failed: "Falhou",
};

export const statusColors: Record<PaymentStatus, string> = {
  pending: "secondary",
  awaiting_payment: "secondary",
  approved: "default",
  authorized: "default",
  in_process: "secondary",
  in_mediation: "secondary",
  rejected: "destructive",
  canceled: "destructive",
  refunded: "destructive",
  charged_back: "destructive",
  expired: "destructive",
  failed: "destructive",
};

export const methodLabels: Record<PaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  card: "Cartão",
};
