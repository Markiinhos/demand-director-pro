import { useClients, Client } from "@/hooks/useClients";
import { useClientInteractions } from "@/hooks/useClientInteractions";
import { useState, useMemo } from "react";
import {
  Plus, Phone, Mail, Building2, MessageCircle, Edit, Trash2, Loader2,
  Search, Filter, LayoutGrid, List, Columns3, Instagram, MapPin,
  ChevronRight, Clock, Star, UserPlus, ArrowRight, GripVertical,
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
import { ClientLogoUpload } from "@/components/clients/ClientLogoUpload";
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
  novo_lead: "Novo Lead",
  contato_inicial: "Contato Inicial",
  briefing: "Briefing",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  aprovado: "Aprovado",
  perdido: "Perdido",
  inativo: "Inativo",
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
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  proposta: "Proposta",
  followup: "Follow-up",
  fechamento: "Fechamento",
  sem_retorno: "Sem Retorno",
};

const potentialLabels: Record<ClosePotential, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

const KANBAN_STAGES: LeadStage[] = ["novo_lead", "contato_inicial", "briefing", "proposta_enviada", "negociacao", "aprovado", "perdido"];

const emptyForm = {
  name: "", contact_name: "", email: "", phone: "", notes: "",
  status: "ativo" as ClientStatus, type: "cliente" as ClientType,
  lead_stage: "" as string, lead_source: "", segment: "", city: "", state: "",
  instagram: "", specialty: "", service_provided: "",
  first_contact_at: "", next_action: "", next_action_date: "",
  sales_notes: "", close_potential: "" as string,
  logo_url: null as string | null,
};

export default function Clientes() {
  const { clients, isLoading, create, update, remove } = useClients();
  const { interactions, create: createInteraction } = useClientInteractions();
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
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
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm({
      name: c.name,
      contact_name: c.contact_name || "",
      email: c.email || "",
      phone: c.phone || "",
      notes: c.notes || "",
      status: c.status,
      type: c.type,
      lead_stage: c.lead_stage || "",
      lead_source: c.lead_source || "",
      segment: c.segment || "",
      city: c.city || "",
      state: c.state || "",
      instagram: c.instagram || "",
      specialty: c.specialty || "",
      service_provided: c.service_provided || "",
      first_contact_at: c.first_contact_at || "",
      next_action: c.next_action || "",
      next_action_date: c.next_action_date || "",
      sales_notes: c.sales_notes || "",
      close_potential: c.close_potential || "",
      logo_url: (c as any).logo_url ?? null,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      lead_stage: (form.lead_stage || null) as LeadStage | null,
      close_potential: (form.close_potential || null) as ClosePotential | null,
      first_contact_at: form.first_contact_at || null,
      next_action_date: form.next_action_date || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
      lead_source: form.lead_source || null,
      segment: form.segment || null,
      city: form.city || null,
      state: form.state || null,
      instagram: form.instagram || null,
      specialty: form.specialty || null,
      service_provided: form.service_provided || null,
      next_action: form.next_action || null,
      sales_notes: form.sales_notes || null,
      logo_url: form.logo_url || null,
    };
    if (editingClient) {
      update.mutate({ id: editingClient.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); setForm(emptyForm); } });
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
        (c.segment || "").toLowerCase().includes(q)
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
            return (
              <div key={client.id} className="flex items-center justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailClient(client)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.contact_name}{client.segment ? ` • ${client.segment}` : ""}{client.city ? ` • ${client.city}` : ""}
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
                  <Building2 className="h-5 w-5 text-primary" />
                  {detailClient.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${typeMap[detailClient.type].color}`}>{typeMap[detailClient.type].label}</span>
                  <Badge variant={statusMap[detailClient.status].variant}>{statusMap[detailClient.status].label}</Badge>
                  {detailClient.lead_stage && <span className={`text-xs px-2 py-1 rounded-full ${stageColors[detailClient.lead_stage]}`}>{stageLabels[detailClient.lead_stage]}</span>}
                  {detailClient.close_potential && <span className="text-xs px-2 py-1 rounded-full bg-muted">{potentialLabels[detailClient.close_potential]}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {detailClient.contact_name && <div><span className="text-muted-foreground text-xs">Contato</span><p>{detailClient.contact_name}</p></div>}
                  {detailClient.email && <div><span className="text-muted-foreground text-xs">Email</span><p>{detailClient.email}</p></div>}
                  {detailClient.phone && <div><span className="text-muted-foreground text-xs">Telefone</span><p>{detailClient.phone}</p></div>}
                  {detailClient.instagram && <div><span className="text-muted-foreground text-xs">Instagram</span><p>{detailClient.instagram}</p></div>}
                  {detailClient.segment && <div><span className="text-muted-foreground text-xs">Segmento</span><p>{detailClient.segment}</p></div>}
                  {(detailClient.city || detailClient.state) && <div><span className="text-muted-foreground text-xs">Localização</span><p>{[detailClient.city, detailClient.state].filter(Boolean).join(", ")}</p></div>}
                  {detailClient.lead_source && <div><span className="text-muted-foreground text-xs">Origem</span><p>{detailClient.lead_source}</p></div>}
                  {detailClient.specialty && <div><span className="text-muted-foreground text-xs">Especialidade</span><p>{detailClient.specialty}</p></div>}
                  {detailClient.service_provided && <div><span className="text-muted-foreground text-xs">Serviço</span><p>{detailClient.service_provided}</p></div>}
                </div>

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

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingClient ? "Editar Contato" : "Novo Contato"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Tipo</Label>
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
            <div><Label>Nome do Contato</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="5511999887766" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ClientStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} placeholder="@perfil" /></div>
            </div>

            {/* CRM fields */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Etapa do Lead</Label>
                <Select value={form.lead_stage} onValueChange={v => setForm(f => ({ ...f, lead_stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(stageLabels) as LeadStage[]).map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Potencial</Label>
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
              <div><Label>Origem</Label><Input value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))} placeholder="Instagram, Indicação..." /></div>
              <div><Label>Segmento</Label><Input value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} placeholder="Restaurante, Saúde..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Estado</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
            </div>

            {/* Terceirizado fields */}
            {form.type === "terceirizado" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-info/5 rounded-lg border border-info/20">
                <div><Label>Especialidade</Label><Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Social Media, Design..." /></div>
                <div><Label>Serviço Prestado</Label><Input value={form.service_provided} onChange={e => setForm(f => ({ ...f, service_provided: e.target.value }))} placeholder="Motion, Copy..." /></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Primeiro Contato</Label><Input type="date" value={form.first_contact_at} onChange={e => setForm(f => ({ ...f, first_contact_at: e.target.value }))} /></div>
              <div><Label>Data Próxima Ação</Label><Input type="date" value={form.next_action_date} onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))} /></div>
            </div>
            <div><Label>Próxima Ação</Label><Input value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} placeholder="Enviar proposta, Follow-up..." /></div>
            <div><Label>Notas Comerciais</Label><Textarea value={form.sales_notes} onChange={e => setForm(f => ({ ...f, sales_notes: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <ClientLogoUpload value={form.logo_url} onChange={(url) => setForm(f => ({ ...f, logo_url: url }))} />

            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingClient ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.03 }}
      className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDetail(client)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
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

      {client.lead_stage && (
        <div className="mb-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageColors[client.lead_stage]}`}>
            {stageLabels[client.lead_stage]}
          </span>
        </div>
      )}

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
