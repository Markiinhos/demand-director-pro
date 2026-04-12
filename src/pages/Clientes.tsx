import { useClients, Client } from "@/hooks/useClients";
import { useState } from "react";
import { Plus, Phone, Mail, Building2, MessageCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WhatsAppDialog } from "@/components/whatsapp/WhatsAppDialog";
import type { Database } from "@/integrations/supabase/types";

type ClientStatus = Database["public"]["Enums"]["client_status"];

const statusMap: Record<ClientStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  lead: { label: "Lead", variant: "outline" },
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "destructive" },
};

const emptyForm = { name: "", contact_name: "", email: "", phone: "", notes: "", status: "ativo" as ClientStatus };

export default function Clientes() {
  const { clients, isLoading, create, update, remove } = useClients();
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<"all" | ClientStatus>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [waClient, setWaClient] = useState<Client | null>(null);

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
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editingClient) {
      update.mutate({ id: editingClient.id, ...form }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(form, { onSuccess: () => { setOpen(false); setForm(emptyForm); } });
    }
  };

  const filteredClients = filter === "all" ? clients : clients.filter(c => c.status === filter);
  const isPending = create.isPending || update.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Novo Cliente</Button>
      </div>

      <div className="flex gap-2">
        {(["all", "lead", "ativo", "inativo"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            {f === "all" ? "Todos" : statusMap[f].label} ({f === "all" ? clients.length : clients.filter(c => c.status === f).length})
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredClients.map((client, i) => {
            const st = statusMap[client.status];
            return (
              <motion.div key={client.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow">
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
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                <div className="flex gap-2 mb-3">
                  {client.phone && (
                    <button onClick={() => setWaClient(client)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors font-medium">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </button>
                  )}
                  {client.email && (
                    <button onClick={() => window.open(`mailto:${client.email}`, "_blank")}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-info/10 text-info hover:bg-info/20 transition-colors font-medium">
                      <Mail className="h-3 w-3" /> Email
                    </button>
                  )}
                </div>

                {client.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Phone className="h-3 w-3" />{client.phone}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 pt-3 border-t border-border/50">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Nome do Contato</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="5511999887766" /></div>
            </div>
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
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingClient ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        title="Excluir cliente" description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={remove.isPending} />

      {waClient && (
        <WhatsAppDialog open={!!waClient} onOpenChange={() => setWaClient(null)}
          clientId={waClient.id} clientName={waClient.name} phone={waClient.phone || ""} />
      )}
    </div>
  );
}
