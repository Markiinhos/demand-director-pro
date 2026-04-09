import { useAgency } from "@/contexts/AgencyContext";
import { useState } from "react";
import { Plus, Phone, Mail, Building2, MessageCircle, Send, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client, ClientStatus, ContactInteraction } from "@/types/agency";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

const statusMap: Record<ClientStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  lead: { label: 'Lead', variant: 'outline' },
  active: { label: 'Ativo', variant: 'default' },
  recurring: { label: 'Recorrente', variant: 'secondary' },
  inactive: { label: 'Inativo', variant: 'destructive' },
};

export default function Clientes() {
  const { clients, setClients, demands, interactions, setInteractions } = useAgency();
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ channel: 'whatsapp' as 'whatsapp' | 'email', direction: 'outbound' as 'inbound' | 'outbound', subject: '', summary: '' });
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', whatsapp: '', status: 'active' as ClientStatus });
  const [filter, setFilter] = useState<'all' | ClientStatus>('all');

  const handleCreate = () => {
    if (!form.name || !form.company) return;
    const newClient: Client = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString().split('T')[0] };
    setClients(prev => [...prev, newClient]);
    setForm({ name: '', company: '', email: '', phone: '', whatsapp: '', status: 'active' });
    setOpen(false);
  };

  const handleAddInteraction = () => {
    if (!interactionForm.subject || !selectedClient) return;
    const interaction: ContactInteraction = {
      id: Date.now().toString(),
      ...interactionForm,
      date: new Date().toISOString().split('T')[0],
      relatedTo: 'client',
      relatedId: selectedClient.id,
    };
    setInteractions(prev => [...prev, interaction]);
    setInteractionForm({ channel: 'whatsapp', direction: 'outbound', subject: '', summary: '' });
    setInteractionOpen(false);
  };

  const filteredClients = filter === 'all' ? clients : clients.filter(c => c.status === filter);

  const openWhatsApp = (whatsapp?: string) => {
    if (whatsapp) window.open(`https://wa.me/${whatsapp}`, '_blank');
  };

  const openEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} clientes cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Empresa</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="5511999887766" /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ClientStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="recurring">Recorrente</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">Cadastrar Cliente</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'lead', 'active', 'recurring', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {f === 'all' ? 'Todos' : statusMap[f].label} ({f === 'all' ? clients.length : clients.filter(c => c.status === f).length})
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredClients.map((client, i) => {
            const clientDemands = demands.filter(d => d.clientId === client.id);
            const activeDemands = clientDemands.filter(d => d.status !== 'done').length;
            const clientInteractions = interactions.filter(int => int.relatedTo === 'client' && int.relatedId === client.id);
            const st = statusMap[client.status];
            return (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedClient(client)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{client.company}</p>
                      <p className="text-xs text-muted-foreground">{client.name}</p>
                    </div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                {/* Contact buttons */}
                <div className="flex gap-2 mb-3">
                  {client.whatsapp && (
                    <button onClick={(e) => { e.stopPropagation(); openWhatsApp(client.whatsapp); }}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors font-medium">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </button>
                  )}
                  {client.email && (
                    <button onClick={(e) => { e.stopPropagation(); openEmail(client.email); }}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-info/10 text-info hover:bg-info/20 transition-colors font-medium">
                      <Mail className="h-3 w-3" /> Email
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{client.phone}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">{clientDemands.length} demandas</span>
                  <div className="flex items-center gap-3">
                    {activeDemands > 0 && <span className="text-xs text-primary font-medium">{activeDemands} ativas</span>}
                    {clientInteractions.length > 0 && <span className="text-xs text-muted-foreground">{clientInteractions.length} conversas</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Client detail dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(v) => !v && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl">
          {selectedClient && (() => {
            const clientDemands = demands.filter(d => d.clientId === selectedClient.id);
            const clientInteractions = interactions.filter(int => int.relatedTo === 'client' && int.relatedId === selectedClient.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span>{selectedClient.company}</span>
                      <p className="text-sm font-normal text-muted-foreground">{selectedClient.name}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 mb-2">
                  {selectedClient.whatsapp && (
                    <Button size="sm" variant="outline" onClick={() => openWhatsApp(selectedClient.whatsapp)} className="text-success border-success/30 hover:bg-success/10">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEmail(selectedClient.email)} className="text-info border-info/30 hover:bg-info/10">
                    <Mail className="h-3.5 w-3.5 mr-1.5" /> Email <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInteractionOpen(true)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Registrar Conversa
                  </Button>
                </div>

                <Tabs defaultValue="demands">
                  <TabsList>
                    <TabsTrigger value="demands">Demandas ({clientDemands.length})</TabsTrigger>
                    <TabsTrigger value="conversations">Conversas ({clientInteractions.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="demands" className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
                    {clientDemands.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma demanda</p>
                    ) : clientDemands.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                        <div>
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">{d.type} • {new Date(d.dueDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.status === 'done' ? 'bg-success/10 text-success' : d.status === 'review' ? 'bg-kanban-review/10 text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                          {d.status === 'done' ? 'Finalizado' : d.status === 'review' ? 'Revisão' : d.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="conversations" className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
                    {clientInteractions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conversa registrada</p>
                    ) : clientInteractions.map(int => (
                      <div key={int.id} className="p-3 rounded-lg bg-muted/40">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${int.channel === 'whatsapp' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                            {int.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{int.direction === 'inbound' ? '← Recebido' : '→ Enviado'}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(int.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p className="text-sm font-medium">{int.subject}</p>
                        {int.summary && <p className="text-xs text-muted-foreground mt-0.5">{int.summary}</p>}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add interaction dialog */}
      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Conversa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Canal</Label>
                <Select value={interactionForm.channel} onValueChange={v => setInteractionForm(f => ({ ...f, channel: v as 'whatsapp' | 'email' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Direção</Label>
                <Select value={interactionForm.direction} onValueChange={v => setInteractionForm(f => ({ ...f, direction: v as 'inbound' | 'outbound' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Enviado</SelectItem>
                    <SelectItem value="inbound">Recebido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Assunto</Label><Input value={interactionForm.subject} onChange={e => setInteractionForm(f => ({ ...f, subject: e.target.value }))} /></div>
            <div><Label>Resumo</Label><Textarea value={interactionForm.summary} onChange={e => setInteractionForm(f => ({ ...f, summary: e.target.value }))} /></div>
            <Button onClick={handleAddInteraction} className="w-full">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
