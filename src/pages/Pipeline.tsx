import { useAgency } from "@/contexts/AgencyContext";
import { Lead, PipelineStage } from "@/types/agency";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, DollarSign, MessageCircle, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const stages: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: 'bg-muted-foreground' },
  { id: 'contacted', label: 'Contatado', color: 'bg-info' },
  { id: 'meeting', label: 'Reunião', color: 'bg-kanban-progress' },
  { id: 'proposal', label: 'Proposta', color: 'bg-kanban-review' },
  { id: 'negotiation', label: 'Negociação', color: 'bg-warning' },
  { id: 'closed', label: 'Fechado', color: 'bg-success' },
  { id: 'lost', label: 'Perdido', color: 'bg-destructive' },
];

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Indicação', website: 'Website', other: 'Outro',
};

export default function Pipeline() {
  const { leads, setLeads, team, interactions, setInteractions } = useAgency();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', service: '', estimatedValue: '', source: 'instagram' as Lead['source'], assigneeId: '', notes: '', phone: '', email: '' });

  const handleCreate = () => {
    if (!form.name) return;
    const lead: Lead = {
      id: Date.now().toString(),
      name: form.name, company: form.company, service: form.service,
      estimatedValue: Number(form.estimatedValue) || 0,
      source: form.source, stage: 'lead', assigneeId: form.assigneeId,
      notes: form.notes, probability: 10,
      phone: form.phone || undefined,
      email: form.email || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setLeads(prev => [...prev, lead]);
    setForm({ name: '', company: '', service: '', estimatedValue: '', source: 'instagram', assigneeId: '', notes: '', phone: '', email: '' });
    setOpen(false);
  };

  const moveLead = (id: string, stage: PipelineStage) => {
    const probMap: Record<PipelineStage, number> = { lead: 10, contacted: 25, meeting: 40, proposal: 60, negotiation: 80, closed: 100, lost: 0 };
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage, probability: probMap[stage] } : l));
  };

  const totalPipeline = leads.filter(l => l.stage !== 'lost' && l.stage !== 'closed').reduce((s, l) => s + l.estimatedValue * (l.probability / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Comercial</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Previsão: R$ {totalPipeline.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />Novo Lead</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Empresa</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Serviço</Label><Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} /></div>
                <div><Label>Valor Estimado</Label><Input type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>WhatsApp</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="5511999887766" /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Origem</Label>
                  <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v as Lead['source'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="referral">Indicação</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Responsável</Label>
                  <Select value={form.assigneeId} onValueChange={v => setForm(f => ({ ...f, assigneeId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{team.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">Adicionar Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id);
          return (
            <div key={stage.id} className="kanban-column flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <h3 className="text-sm font-semibold">{stage.label}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{stageLeads.length}</span>
              </div>
              <div className="space-y-2.5 min-h-[150px]">
                <AnimatePresence>
                  {stageLeads.map(lead => {
                    const assignee = team.find(t => t.id === lead.assigneeId);
                    const leadInteractions = interactions.filter(int => int.relatedTo === 'lead' && int.relatedId === lead.id);
                    return (
                      <motion.div key={lead.id} layout
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="kanban-card group">
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground mb-1">{lead.company}</p>
                        <p className="text-xs text-accent-foreground">{lead.service}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-primary">R$ {lead.estimatedValue.toLocaleString('pt-BR')}</span>
                          <span className="text-[10px] text-muted-foreground">{lead.probability}%</span>
                        </div>
                        {/* Contact buttons */}
                        <div className="flex items-center gap-1.5 mt-2">
                          {lead.phone && (
                            <button onClick={() => window.open(`https://wa.me/${lead.phone}`, '_blank')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors flex items-center gap-0.5">
                              <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                            </button>
                          )}
                          {lead.email && (
                            <button onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info hover:bg-info/20 transition-colors flex items-center gap-0.5">
                              <Mail className="h-2.5 w-2.5" /> Email
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{assignee?.name}</span>
                          <div className="flex items-center gap-1.5">
                            {leadInteractions.length > 0 && <span className="text-[10px] text-muted-foreground">{leadInteractions.length} conversas</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{sourceLabels[lead.source]}</span>
                          </div>
                        </div>
                        <div className="hidden group-hover:flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                          {stages.filter(s => s.id !== stage.id).map(target => (
                            <button key={target.id} onClick={() => moveLead(lead.id, target.id)}
                              className="text-[10px] px-1.5 py-1 rounded bg-muted hover:bg-accent transition-colors">
                              {target.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
