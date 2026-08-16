import { useClients, Client } from "@/hooks/useClients";
import { useClientInteractions } from "@/hooks/useClientInteractions";
import { useAsaasCharges } from "@/hooks/useAsaasCharges";
import { useState, useMemo } from "react";
import {
  Plus, Phone, Mail, Building2, MessageCircle, Edit, Trash2, Loader2,
  Search, Filter, LayoutGrid, List, Columns3, Instagram, MapPin,
  ChevronRight, Clock, Star, UserPlus, ArrowRight, GripVertical,
  User, FileText, ShieldCheck, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WhatsAppDialog } from "@/components/whatsapp/WhatsAppDialog";
import { PortalLinkDialog } from "@/components/portal/PortalLinkDialog";
import {
  ClientFormDialog,
  emptyClientForm,
  clientToForm,
  formToPayload,
  type ClientFormData,
} from "@/components/clients/ClientFormDialog";
import { maskCPF, maskCNPJ, maskDocument, formatPhone, personTypeLabel } from "@/lib/document-utils";
import type { Database } from "@/integrations/supabase/types";

type ClientType = Database["public"]["Enums"]["client_type"];
type ClientStatus = Database["public"]["Enums"]["client_status"];
type LeadStage = Database["public"]["Enums"]["lead_stage"];
type ClosePotential = Database["public"]["Enums"]["close_potential"];
type InteractionType = Database["public"]["Enums"]["interaction_type"];

const typeMap: Record<ClientType, { label: string; color: string }> = {
  cliente: { label: "Cliente", color: "bg-primary/10 text-primary" },
  lead: { label: "Lead", color: "bg-warning/10 text-warning" },
  terceirizado: { label: "Terceirizado", color: "bg-info/10 text-info" },
  parceiro: { label: "Parceiro", color: "bg-success/10 text-success" },
};

const statusMap: Record<ClientStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  lead: { label: "Lead", variant: "outline" },
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "destructive" },
};

const stageLabels: Record<LeadStage, string> = {
  novo_lead: "Novo Lead", contato_inicial: "Contato Inicial", briefing: "Briefing",
  proposta_enviada: "Proposta Enviada", negociacao: "Negociação",
  aprovado: "Aprovado", perdido: "Perdido", inativo: "Inativo",
};

const stageColors: Record<LeadStage, string> = {
  novo_lead: "bg-blue-500/10 text-blue-600",
  contato_inicial: "bg-cyan-500/10 text-cyan-600",
  briefing: "bg-violet-500/10 text-violet-600",
  proposta_enviada: "bg-amber-500/10 text-amber-600",
  negociacao: "bg-orange-500/10 text-orange-600",
  aprovado: "bg-emerald-500/10 text-emerald-600",
  perdido: "bg-red-500/10 text-red-600",
  inativo: "bg-gray-500/10 text-gray-600",
};

const interactionLabels: Record<InteractionType, string> = {
  ligacao: "Ligação", whatsapp: "WhatsApp", reuniao: "Reunião",
  proposta: "Proposta", followup: "Follow-up", fechamento: "Fechamento",
  sem_retorno: "Sem Retorno",
};

const potentialLabels: Record<ClosePotential, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

const KANBAN_STAGES: LeadStage[] = ["novo_lead", "contato_inicial", "briefing", "proposta_enviada", "negociacao", "aprovado", "perdido"];

export default function Clientes() {
  const { clients, isLoading, create, update, remove } = useClients();
  const { interactions, create: createInteraction } = useClientInteractions();
  const { syncClient, isSyncingClient } = useAsaasCharges();
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormData>(emptyClientForm);
  const [filterType, setFilterType] = useState<"all" | ClientType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | ClientStatus>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [waClient, setWaClient] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list" | "kanban">("cards");
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionClientId, setInteractionClientId] = useState<string>("");
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: "whatsapp" as InteractionType,
    description: "",
    next_step: "",
    next_step_date: "",
  });
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const openCreate = () => {
    setEditingClient(null);
    setForm(emptyClientForm);
    setOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm(clientToForm(c));
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const payload = formToPayload(form);
    if (editingClient) {
      update.mutate({ id: editingClient.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); setForm(emptyClientForm); } });
    }
  };

  const handleInteractionSubmit = () => {
    if (!interactionClientId) return;
    createInteraction.mutate({
      client_id: interactionClientId,
      interaction_type: interactionForm.interaction_type,
      description: interactionForm.description || null,
      next_step: interactionForm.next_step || null,
      next_step_date: interactionForm.next_step_date || null,
    }, {
      onSuccess: () => {
        setInteractionOpen(false);
        setInteractionForm({ interaction_type: "whatsapp", description: "", next_step: "", next_step_date: "" });
      },
    });
  };

  const moveStage = (clientId: string, stage: LeadStage) => {
    update.mutate({ id: clientId, lead_stage: stage });
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (filterType !== "all") result = result.filter(c => c.type === filterType);
    if (filterStatus !== "all") result = result.filter(c => c.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.segment || "").toLowerCase().includes(q) ||
        ((c as any).trade_name || "").toLowerCase().includes(q) ||
        ((c as any).full_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [clients, filterType, filterStatus, search]);

  const isPending = create.isPending || update.isPending;
  const clientInteractions = detailClient ? interactions.filter(i => i.client_id === detailClient.id) : [];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM & Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} contatos cadastrados</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Novo Contato</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..." className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.keys(typeMap) as ClientType[]).map(t => <SelectItem key={t} value={t}>{typeMap[t].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.keys(statusMap) as ClientStatus[]).map(s => <SelectItem key={s} value={s}>{statusMap[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 border border-border rounded-lg p-0.5">
          <button onClick={() => setViewMode("cards")} className={`p-1.5 rounded ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("kanban")} className={`p-1.5 rounded ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Columns3 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Views */}
      {viewMode === "cards" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredClients.map((client, i) => (
              <ClientCard key={client.id} client={client} index={i}
                onEdit={openEdit} onDelete={setDeleteId}
                onWhatsApp={setWaClient} onDetail={setDetailClient}
                onInteraction={(id) => { setInteractionClientId(id); setInteractionOpen(true); }}
                onMoveStage={moveStage}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {viewMode === "list" && (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {filteredClients.map(client => {
            const t = typeMap[client.type];
            const st = statusMap[client.status];
            const personType = (client as any).person_type;
            return (
              <div key={client.id} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailClient(client)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {personType === "juridica" ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.contact_name}{client.segment ? ` • ${client.segment}` : ""}{client.city ? ` • ${client.city}` : ""}
                      {personType && <span className="ml-1 text-[10px]">({personType === "fisica" ? "PF" : "PJ"})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {client.lead_stage && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageColors[client.lead_stage]}`}>{stageLabels[client.lead_stage]}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span>
                  <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(client); }}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map(stage => {
            const stageClients = filteredClients.filter(c => c.lead_stage === stage);
            return (
              <div key={stage} className="kanban-column flex-shrink-0 min-w-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stageColors[stage]}`}>{stageLabels[stage]}</span>
                  <span className="text-xs text-muted-foreground">{stageClients.length}</span>
                </div>
                <div className="space-y-2">
                  {stageClients.map(client => (
                    <div key={client.id} className="kanban-card" onClick={() => setDetailClient(client)}>
                      <p className="text-sm font-medium mb-1">{client.name}</p>
                      {client.contact_name && <p className="text-xs text-muted-foreground mb-2">{client.contact_name}</p>}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeMap[client.type].color}`}>{typeMap[client.type].label}</span>
                        {client.close_potential && (
                          <span className={`text-[10px] font-medium ${client.close_potential === "alto" ? "text-success" : client.close_potential === "medio" ? "text-warning" : "text-muted-foreground"}`}>
                            {potentialLabels[client.close_potential]}
                          </span>
                        )}
                      </div>
                      {client.next_action && (
                        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />{client.next_action}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-border/30">
                        {KANBAN_STAGES.filter(s => s !== stage && s !== "perdido").slice(0, 3).map(s => (
                          <button key={s} onClick={(e) => { e.stopPropagation(); moveStage(client.id, s); }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground" title={`Mover para ${stageLabels[s]}`}>
                            {stageLabels[s].split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Dialog open={!!detailClient} onOpenChange={() => setDetailClient(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(detailClient as any).person_type === "juridica"
                    ? <Building2 className="h-5 w-5 text-primary" />
                    : <User className="h-5 w-5 text-primary" />
                  }
                  {detailClient.name}
                  {(detailClient as any).person_type && (
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {(detailClient as any).person_type === "fisica" ? "PF" : "PJ"}
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${typeMap[detailClient.type].color}`}>{typeMap[detailClient.type].label}</span>
                  <Badge variant={statusMap[detailClient.status].variant}>{statusMap[detailClient.status].label}</Badge>
                  {detailClient.lead_stage && <span className={`text-xs px-2 py-1 rounded-full ${stageColors[detailClient.lead_stage]}`}>{stageLabels[detailClient.lead_stage]}</span>}
                  {detailClient.close_potential && <span className="text-xs px-2 py-1 rounded-full bg-muted">{potentialLabels[detailClient.close_potential]}</span>}
                </div>

                {/* Dados PF/PJ */}
                {(detailClient as any).person_type && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                      <ShieldCheck className="h-3.5 w-3.5" />Dados Fiscais
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {(detailClient as any).full_name && <div><span className="text-muted-foreground text-xs">Nome Completo</span><p>{(detailClient as any).full_name}</p></div>}
                      {(detailClient as any).trade_name && <div><span className="text-muted-foreground text-xs">Nome Fantasia</span><p>{(detailClient as any).trade_name}</p></div>}
                      {(detailClient as any).cpf && <div><span className="text-muted-foreground text-xs">CPF</span><p className="font-mono text-xs">{maskCPF((detailClient as any).cpf)}</p></div>}
                      {(detailClient as any).cnpj && <div><span className="text-muted-foreground text-xs">CNPJ</span><p className="font-mono text-xs">{maskCNPJ((detailClient as any).cnpj)}</p></div>}
                      {(detailClient as any).rg && <div><span className="text-muted-foreground text-xs">RG</span><p className="font-mono text-xs">***{(detailClient as any).rg.slice(-3)}</p></div>}
                      {(detailClient as any).birth_date && <div><span className="text-muted-foreground text-xs">Nascimento</span><p>{new Date((detailClient as any).birth_date).toLocaleDateString("pt-BR")}</p></div>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {detailClient.contact_name && <div><span className="text-muted-foreground text-xs">Contato</span><p>{detailClient.contact_name}</p></div>}
                  {detailClient.email && <div><span className="text-muted-foreground text-xs">Email</span><p>{detailClient.email}</p></div>}
                  {detailClient.phone && <div><span className="text-muted-foreground text-xs">Telefone</span><p>{formatPhone(detailClient.phone)}</p></div>}
                  {(detailClient as any).whatsapp && <div><span className="text-muted-foreground text-xs">WhatsApp</span><p>{formatPhone((detailClient as any).whatsapp)}</p></div>}
                  {detailClient.instagram && <div><span className="text-muted-foreground text-xs">Instagram</span><p>{detailClient.instagram}</p></div>}
                  {detailClient.segment && <div><span className="text-muted-foreground text-xs">Segmento</span><p>{detailClient.segment}</p></div>}
                  {detailClient.lead_source && <div><span className="text-muted-foreground text-xs">Origem</span><p>{detailClient.lead_source}</p></div>}
                  {detailClient.specialty && <div><span className="text-muted-foreground text-xs">Especialidade</span><p>{detailClient.specialty}</p></div>}
                  {detailClient.service_provided && <div><span className="text-muted-foreground text-xs">Serviço</span><p>{detailClient.service_provided}</p></div>}
                </div>

                {/* Endereço */}
                {((detailClient as any).street || (detailClient as any).zip_code || detailClient.city) && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                      <MapPin className="h-3.5 w-3.5" />Endereço
                    </p>
                    <p className="text-sm">
                      {[(detailClient as any).street,
                        (detailClient as any).address_number && `nº ${(detailClient as any).address_number}`,
                        (detailClient as any).complement,
                      ].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-sm">
                      {[(detailClient as any).neighborhood,
                        detailClient.city,
                        detailClient.state,
                        (detailClient as any).zip_code && `CEP: ${(detailClient as any).zip_code}`,
                      ].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                )}

                {detailClient.next_action && (
                  <div className="bg-accent/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Próxima ação</p>
                    <p className="text-sm font-medium">{detailClient.next_action}</p>
                    {detailClient.next_action_date && <p className="text-xs text-muted-foreground mt-1">{new Date(detailClient.next_action_date).toLocaleDateString("pt-BR")}</p>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setDetailClient(null); openEdit(detailClient); }}><Edit className="h-3.5 w-3.5 mr-1" />Editar</Button>
                  {detailClient.phone && <Button size="sm" variant="outline" onClick={() => { setDetailClient(null); setWaClient(detailClient); }}><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</Button>}
                  <Button size="sm" variant="outline" onClick={() => { setInteractionClientId(detailClient.id); setInteractionOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" />Interação</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => syncClient(detailClient.id)}
                    disabled={isSyncingClient}
                  >
                    {isSyncingClient ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                    {(detailClient as any).asaas_customer_id ? "Sincronizar Asaas" : "Cadastrar no Asaas"}
                  </Button>
                  <PortalLinkDialog clientId={detailClient.id} />
                </div>

                {/* Interactions history */}
                <div>
                  <p className="text-sm font-semibold mb-2">Histórico de Interações</p>
                  {clientInteractions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma interação registrada</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {clientInteractions.map(inter => (
                        <div key={inter.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock className="h-3 w-3 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{interactionLabels[inter.interaction_type]} • {new Date(inter.interaction_date).toLocaleDateString("pt-BR")}</p>
                            {inter.description && <p className="text-xs text-muted-foreground">{inter.description}</p>}
                            {inter.next_step && <p className="text-xs text-primary mt-1">→ {inter.next_step}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog — now uses the new ClientFormDialog component */}
      <ClientFormDialog
        open={open}
        onOpenChange={setOpen}
        editingClient={editingClient}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isPending={isPending}
      />

      {/* Interaction Dialog */}
      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Interação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={interactionForm.interaction_type} onValueChange={v => setInteractionForm(f => ({ ...f, interaction_type: v as InteractionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(interactionLabels) as InteractionType[]).map(t => <SelectItem key={t} value={t}>{interactionLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={interactionForm.description} onChange={e => setInteractionForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Próximo Passo</Label><Input value={interactionForm.next_step} onChange={e => setInteractionForm(f => ({ ...f, next_step: e.target.value }))} /></div>
            <div><Label>Data Próximo Passo</Label><Input type="date" value={interactionForm.next_step_date} onChange={e => setInteractionForm(f => ({ ...f, next_step_date: e.target.value }))} /></div>
            <Button onClick={handleInteractionSubmit} className="w-full" disabled={createInteraction.isPending}>
              {createInteraction.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="Excluir contato" description="Tem certeza que deseja excluir? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={remove.isPending} />

      {waClient && (
        <WhatsAppDialog open={!!waClient} onOpenChange={() => setWaClient(null)}
          clientId={waClient.id} clientName={waClient.name} phone={waClient.phone || ""} />
      )}
    </div>
  );
}

function ClientCard({ client, index, onEdit, onDelete, onWhatsApp, onDetail, onInteraction, onMoveStage }: {
  client: Client; index: number;
  onEdit: (c: Client) => void; onDelete: (id: string) => void;
  onWhatsApp: (c: Client) => void; onDetail: (c: Client) => void;
  onInteraction: (id: string) => void; onMoveStage: (id: string, stage: LeadStage) => void;
}) {
  const t = typeMap[client.type];
  const st = statusMap[client.status];
  const personType = (client as any).person_type;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.03 }}
      className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDetail(client)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {personType === "juridica" ? <Building2 className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <p className="font-semibold text-sm">{client.name}</p>
            {client.contact_name && <p className="text-xs text-muted-foreground">{client.contact_name}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span>
          <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {client.lead_stage && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageColors[client.lead_stage]}`}>
            {stageLabels[client.lead_stage]}
          </span>
        )}
        {personType && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">
            {personType === "fisica" ? "PF" : "PJ"}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {client.phone && (
          <button onClick={(e) => { e.stopPropagation(); onWhatsApp(client); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors font-medium">
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </button>
        )}
        {client.email && (
          <button onClick={(e) => { e.stopPropagation(); window.open(`mailto:${client.email}`, "_blank"); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-info/10 text-info hover:bg-info/20 transition-colors font-medium">
            <Mail className="h-3 w-3" /> Email
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onInteraction(client.id); }}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors font-medium">
          <Plus className="h-3 w-3" /> Interação
        </button>
      </div>

      {client.next_action && (
        <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {client.next_action}
          {client.next_action_date && ` • ${new Date(client.next_action_date).toLocaleDateString("pt-BR")}`}
        </p>
      )}

      {(client.segment || client.city) && (
        <p className="text-[10px] text-muted-foreground mb-2">
          {[client.segment, client.city].filter(Boolean).join(" • ")}
        </p>
      )}

      <div className="flex items-center justify-end gap-1 pt-3 border-t border-border/50">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(client); }}><Edit className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </motion.div>
  );
}
