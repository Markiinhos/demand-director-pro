import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClientLogoUpload } from "@/components/clients/ClientLogoUpload";
import { useCepLookup } from "@/hooks/useCepLookup";
import {
  formatCPF, formatCNPJ, formatPhone, formatCEP,
  validateCPF, validateCNPJ, onlyDigits,
} from "@/lib/document-utils";
import {
  Loader2, User, Building2, MapPin, Briefcase, FileText,
  AlertCircle, Search as SearchIcon,
} from "lucide-react";
import type { Client } from "@/hooks/useClients";
import type { Database } from "@/integrations/supabase/types";

type ClientType = Database["public"]["Enums"]["client_type"];
type ClientStatus = Database["public"]["Enums"]["client_status"];
type LeadStage = Database["public"]["Enums"]["lead_stage"];
type ClosePotential = Database["public"]["Enums"]["close_potential"];
type PersonType = Database["public"]["Enums"]["person_type"];

const stageLabels: Record<LeadStage, string> = {
  novo_lead: "Novo Lead", contato_inicial: "Contato Inicial", briefing: "Briefing",
  proposta_enviada: "Proposta Enviada", negociacao: "Negociação",
  aprovado: "Aprovado", perdido: "Perdido", inativo: "Inativo",
};

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export interface ClientFormData {
  name: string;
  person_type: PersonType | "";
  full_name: string;
  legal_name: string;
  trade_name: string;
  cpf: string;
  cnpj: string;
  rg: string;
  state_registration: string;
  municipal_registration: string;
  birth_date: string;
  contact_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  zip_code: string;
  street: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  status: ClientStatus;
  type: ClientType;
  lead_stage: string;
  lead_source: string;
  segment: string;
  specialty: string;
  service_provided: string;
  first_contact_at: string;
  next_action: string;
  next_action_date: string;
  sales_notes: string;
  close_potential: string;
  notes: string;
  logo_url: string | null;
}

export const emptyClientForm: ClientFormData = {
  name: "", person_type: "", full_name: "", legal_name: "", trade_name: "",
  cpf: "", cnpj: "", rg: "", state_registration: "", municipal_registration: "",
  birth_date: "", contact_name: "", email: "", phone: "", whatsapp: "",
  instagram: "", zip_code: "", street: "", address_number: "", complement: "",
  neighborhood: "", city: "", state: "", country: "Brasil",
  status: "ativo", type: "cliente", lead_stage: "", lead_source: "",
  segment: "", specialty: "", service_provided: "", first_contact_at: "",
  next_action: "", next_action_date: "", sales_notes: "", close_potential: "",
  notes: "", logo_url: null,
};

export function clientToForm(c: Client): ClientFormData {
  return {
    name: c.name,
    person_type: (c as any).person_type || "",
    full_name: (c as any).full_name || "",
    legal_name: (c as any).legal_name || "",
    trade_name: (c as any).trade_name || "",
    cpf: (c as any).cpf || "",
    cnpj: (c as any).cnpj || "",
    rg: (c as any).rg || "",
    state_registration: (c as any).state_registration || "",
    municipal_registration: (c as any).municipal_registration || "",
    birth_date: (c as any).birth_date || "",
    contact_name: c.contact_name || "",
    email: c.email || "",
    phone: c.phone || "",
    whatsapp: (c as any).whatsapp || "",
    instagram: c.instagram || "",
    zip_code: (c as any).zip_code || "",
    street: (c as any).street || "",
    address_number: (c as any).address_number || "",
    complement: (c as any).complement || "",
    neighborhood: (c as any).neighborhood || "",
    city: c.city || "",
    state: c.state || "",
    country: (c as any).country || "Brasil",
    status: c.status,
    type: c.type,
    lead_stage: c.lead_stage || "",
    lead_source: c.lead_source || "",
    segment: c.segment || "",
    specialty: c.specialty || "",
    service_provided: c.service_provided || "",
    first_contact_at: c.first_contact_at || "",
    next_action: c.next_action || "",
    next_action_date: c.next_action_date || "",
    sales_notes: c.sales_notes || "",
    close_potential: c.close_potential || "",
    notes: c.notes || "",
    logo_url: (c as any).logo_url ?? null,
  };
}

export function formToPayload(form: ClientFormData) {
  return {
    name: form.name,
    person_type: (form.person_type || null) as PersonType | null,
    full_name: form.full_name || null,
    legal_name: form.legal_name || null,
    trade_name: form.trade_name || null,
    cpf: form.cpf ? onlyDigits(form.cpf) : null,
    cnpj: form.cnpj ? onlyDigits(form.cnpj) : null,
    rg: form.rg || null,
    state_registration: form.state_registration || null,
    municipal_registration: form.municipal_registration || null,
    birth_date: form.birth_date || null,
    contact_name: form.contact_name || null,
    email: form.email || null,
    phone: form.phone ? onlyDigits(form.phone) : null,
    whatsapp: form.whatsapp ? onlyDigits(form.whatsapp) : null,
    instagram: form.instagram || null,
    zip_code: form.zip_code ? onlyDigits(form.zip_code) : null,
    street: form.street || null,
    address_number: form.address_number || null,
    complement: form.complement || null,
    neighborhood: form.neighborhood || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || "Brasil",
    status: form.status,
    type: form.type,
    lead_stage: (form.lead_stage || null) as LeadStage | null,
    lead_source: form.lead_source || null,
    segment: form.segment || null,
    specialty: form.specialty || null,
    service_provided: form.service_provided || null,
    first_contact_at: form.first_contact_at || null,
    next_action: form.next_action || null,
    next_action_date: form.next_action_date || null,
    sales_notes: form.sales_notes || null,
    close_potential: (form.close_potential || null) as ClosePotential | null,
    notes: form.notes || null,
    logo_url: form.logo_url || null,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient: Client | null;
  form: ClientFormData;
  setForm: React.Dispatch<React.SetStateAction<ClientFormData>>;
  onSubmit: () => void;
  isPending: boolean;
}

export function ClientFormDialog({
  open, onOpenChange, editingClient, form, setForm, onSubmit, isPending,
}: Props) {
  const [formTab, setFormTab] = useState("dados");
  const [docErrors, setDocErrors] = useState<{cpf?: string; cnpj?: string}>({});

  const handleCepResult = useCallback((data: { street: string; neighborhood: string; city: string; state: string }) => {
    setForm(f => ({
      ...f,
      street: data.street || f.street,
      neighborhood: data.neighborhood || f.neighborhood,
      city: data.city || f.city,
      state: data.state || f.state,
    }));
  }, [setForm]);

  const { lookup: lookupCep, isLoading: cepLoading, error: cepError } = useCepLookup(handleCepResult);

  // Reset tab ao abrir
  useEffect(() => {
    if (open) setFormTab("dados");
  }, [open]);

  const isPF = form.person_type === "fisica";
  const isPJ = form.person_type === "juridica";

  // Validation
  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setForm(f => ({ ...f, cpf: formatted }));
    const digits = onlyDigits(value);
    if (digits.length === 11) {
      setDocErrors(e => ({
        ...e,
        cpf: validateCPF(digits) ? undefined : "CPF inválido",
      }));
    } else {
      setDocErrors(e => ({ ...e, cpf: undefined }));
    }
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm(f => ({ ...f, cnpj: formatted }));
    const digits = onlyDigits(value);
    if (digits.length === 14) {
      setDocErrors(e => ({
        ...e,
        cnpj: validateCNPJ(digits) ? undefined : "CNPJ inválido",
      }));
    } else {
      setDocErrors(e => ({ ...e, cnpj: undefined }));
    }
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCEP(value);
    setForm(f => ({ ...f, zip_code: formatted }));
    lookupCep(value);
  };

  const handlePhoneChange = (field: "phone" | "whatsapp", value: string) => {
    const formatted = formatPhone(value);
    setForm(f => ({ ...f, [field]: formatted }));
  };

  const hasDocErrors = !!docErrors.cpf || !!docErrors.cnpj;
  const canSubmit = form.name.trim() && !hasDocErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingClient ? (
              <><FileText className="h-5 w-5 text-primary" />Editar Contato</>
            ) : (
              <><User className="h-5 w-5 text-primary" />Novo Contato</>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dados" className="text-xs">
              <User className="h-3.5 w-3.5 mr-1" />Dados
            </TabsTrigger>
            <TabsTrigger value="endereco" className="text-xs">
              <MapPin className="h-3.5 w-3.5 mr-1" />Endereço
            </TabsTrigger>
            <TabsTrigger value="crm" className="text-xs">
              <Briefcase className="h-3.5 w-3.5 mr-1" />CRM
            </TabsTrigger>
            <TabsTrigger value="obs" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" />Obs
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB: Dados Pessoais / Empresa ─── */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            {/* Tipo de Pessoa */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium min-w-fit">Tipo de pessoa</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, person_type: "fisica" }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isPF
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />Pessoa Física
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, person_type: "juridica" }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isPJ
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />Pessoa Jurídica
                </button>
              </div>
            </div>

            {/* Nome (sempre visível) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={isPJ ? "Razão Social" : "Nome completo"}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ClientType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="terceirizado">Terceirizado</SelectItem>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pessoa Física */}
            {isPF && (
              <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />Dados Pessoa Física
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={form.cpf}
                      onChange={e => handleCpfChange(e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={docErrors.cpf ? "border-destructive" : ""}
                    />
                    {docErrors.cpf && (
                      <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{docErrors.cpf}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>RG</Label>
                    <Input
                      value={form.rg}
                      onChange={e => setForm(f => ({ ...f, rg: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={form.birth_date}
                      onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pessoa Jurídica */}
            {isPJ && (
              <div className="space-y-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <p className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />Dados Pessoa Jurídica
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={form.trade_name}
                      onChange={e => setForm(f => ({ ...f, trade_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      value={form.cnpj}
                      onChange={e => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className={docErrors.cnpj ? "border-destructive" : ""}
                    />
                    {docErrors.cnpj && (
                      <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{docErrors.cnpj}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Inscrição Estadual</Label>
                    <Input
                      value={form.state_registration}
                      onChange={e => setForm(f => ({ ...f, state_registration: e.target.value }))}
                      placeholder="Isento ou número"
                    />
                  </div>
                  <div>
                    <Label>Inscrição Municipal</Label>
                    <Input
                      value={form.municipal_registration}
                      onChange={e => setForm(f => ({ ...f, municipal_registration: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Responsável pelo Contato</Label>
                  <Input
                    value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Contato (PF ou PJ ou sem tipo definido) */}
            {!isPJ && (
              <div>
                <Label>Nome do Contato</Label>
                <Input
                  value={form.contact_name}
                  onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ClientStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={e => handlePhoneChange("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={e => handlePhoneChange("whatsapp", e.target.value)}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>
            </div>

            <div>
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                placeholder="@perfil"
              />
            </div>

            <ClientLogoUpload value={form.logo_url} onChange={(url) => setForm(f => ({ ...f, logo_url: url }))} />
          </TabsContent>

          {/* ─── TAB: Endereço ─── */}
          <TabsContent value="endereco" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    value={form.zip_code}
                    onChange={e => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                {cepError && (
                  <p className="text-[10px] text-destructive mt-0.5">{cepError}</p>
                )}
              </div>
              <div className="col-span-2">
                <Label>Rua / Logradouro</Label>
                <Input
                  value={form.street}
                  onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Número</Label>
                <Input
                  value={form.address_number}
                  onChange={e => setForm(f => ({ ...f, address_number: e.target.value }))}
                  placeholder="Ex: 123"
                />
              </div>
              <div className="col-span-2">
                <Label>Complemento</Label>
                <Input
                  value={form.complement}
                  onChange={e => setForm(f => ({ ...f, complement: e.target.value }))}
                  placeholder="Apto, bloco, sala..."
                />
              </div>
            </div>

            <div>
              <Label>Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>País</Label>
                <Input
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                />
              </div>
            </div>
          </TabsContent>

          {/* ─── TAB: CRM ─── */}
          <TabsContent value="crm" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etapa do Lead</Label>
                <Select value={form.lead_stage} onValueChange={v => setForm(f => ({ ...f, lead_stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(stageLabels) as LeadStage[]).map(s => (
                      <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Potencial</Label>
                <Select value={form.close_potential} onValueChange={v => setForm(f => ({ ...f, close_potential: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Input
                  value={form.lead_source}
                  onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                  placeholder="Instagram, Indicação..."
                />
              </div>
              <div>
                <Label>Segmento</Label>
                <Input
                  value={form.segment}
                  onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                  placeholder="Restaurante, Saúde..."
                />
              </div>
            </div>

            {form.type === "terceirizado" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-info/5 rounded-lg border border-info/20">
                <div>
                  <Label>Especialidade</Label>
                  <Input
                    value={form.specialty}
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    placeholder="Social Media, Design..."
                  />
                </div>
                <div>
                  <Label>Serviço Prestado</Label>
                  <Input
                    value={form.service_provided}
                    onChange={e => setForm(f => ({ ...f, service_provided: e.target.value }))}
                    placeholder="Motion, Copy..."
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primeiro Contato</Label>
                <Input
                  type="date"
                  value={form.first_contact_at}
                  onChange={e => setForm(f => ({ ...f, first_contact_at: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data Próxima Ação</Label>
                <Input
                  type="date"
                  value={form.next_action_date}
                  onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Próxima Ação</Label>
              <Input
                value={form.next_action}
                onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}
                placeholder="Enviar proposta, Follow-up..."
              />
            </div>

            <div>
              <Label>Notas Comerciais</Label>
              <Textarea
                value={form.sales_notes}
                onChange={e => setForm(f => ({ ...f, sales_notes: e.target.value }))}
              />
            </div>
          </TabsContent>

          {/* ─── TAB: Observações ─── */}
          <TabsContent value="obs" className="space-y-4 mt-4">
            <div>
              <Label>Observações Gerais</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={6}
                placeholder="Informações adicionais sobre o contato..."
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit */}
        <div className="pt-2 border-t border-border/50">
          <Button
            id="client-form-submit"
            onClick={onSubmit}
            className="w-full"
            disabled={isPending || !canSubmit}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            {editingClient ? "Salvar Alterações" : "Cadastrar Contato"}
          </Button>
          {hasDocErrors && (
            <p className="text-xs text-destructive text-center mt-2 flex items-center justify-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Corrija os erros de documentos antes de salvar
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
