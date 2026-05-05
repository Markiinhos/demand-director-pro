import { useState } from "react";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, FileCode, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PREDEFINED_TEMPLATES = [
  { name: "Cobrança Pendente", key: "cobranca_pendente", category: "UTILITY" },
  { name: "Cobrança Vencida", key: "cobranca_vencida", category: "UTILITY" },
  { name: "Pagamento Confirmado", key: "pagamento_confirmado", category: "UTILITY" },
  { name: "Contrato Enviado", key: "contrato_enviado", category: "UTILITY" },
  { name: "Orçamento Enviado", key: "orcamento_enviado", category: "UTILITY" },
  { name: "Proposta Enviada", key: "proposta_enviada", category: "MARKETING" },
  { name: "Solicitação de Aprovação", key: "solicitacao_aprovacao", category: "UTILITY" },
  { name: "Lembrete de Vencimento", key: "lembrete_vencimento", category: "UTILITY" },
  { name: "Follow-up Orçamento", key: "followup_orcamento", category: "MARKETING" },
];

const categoryLabels: Record<string, string> = {
  UTILITY: "Utilitário",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

export function WhatsAppTemplatesCard() {
  const { templates, saveTemplate, deleteTemplate, isConnected } = useWhatsAppConnection();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    templateKey: "",
    category: "UTILITY",
    languageCode: "pt_BR",
  });
  const [selectedPredefined, setSelectedPredefined] = useState("");

  const handlePredefined = (key: string) => {
    const t = PREDEFINED_TEMPLATES.find(p => p.key === key);
    if (t) {
      setForm({ name: t.name, templateKey: t.key, category: t.category, languageCode: "pt_BR" });
    }
    setSelectedPredefined(key);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.templateKey.trim()) return;
    saveTemplate.mutate({
      name: form.name,
      templateKey: form.templateKey,
      category: form.category,
      languageCode: form.languageCode,
    }, {
      onSuccess: () => {
        setAddOpen(false);
        setForm({ name: "", templateKey: "", category: "UTILITY", languageCode: "pt_BR" });
        setSelectedPredefined("");
      },
    });
  };

  if (!isConnected) return null;

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">Templates de Mensagem</h3>
            <Badge variant="secondary" className="text-[10px]">{templates.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Templates aprovados pela Meta são obrigatórios para enviar mensagens automáticas (cobranças, contratos, etc).
        </p>

        {templates.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum template cadastrado</p>
            <p className="text-xs mt-1">Cadastre os templates aprovados na sua conta Meta</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[10px] bg-background px-1.5 py-0.5 rounded font-mono">{t.template_key}</code>
                    {t.category && (
                      <Badge variant="outline" className="text-[9px]">{categoryLabels[t.category] || t.category}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{t.language_code}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(t.id)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add template dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Modelo Pré-definido</Label>
              <Select value={selectedPredefined} onValueChange={handlePredefined}>
                <SelectTrigger><SelectValue placeholder="Escolher modelo..." /></SelectTrigger>
                <SelectContent>
                  {PREDEFINED_TEMPLATES.filter(p => !templates.some(t => t.template_key === p.key)).map(p => (
                    <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Cobrança Pendente" />
              </div>
              <div className="col-span-2">
                <Label>Template Key *</Label>
                <Input value={form.templateKey} onChange={e => setForm(f => ({ ...f, templateKey: e.target.value }))} placeholder="Ex: cobranca_pendente" className="font-mono text-sm" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Exatamente como cadastrado na Meta</p>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utilitário</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Idioma</Label>
                <Select value={form.languageCode} onValueChange={v => setForm(f => ({ ...f, languageCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (BR)</SelectItem>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saveTemplate.isPending || !form.name.trim() || !form.templateKey.trim()}>
              {saveTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Salvar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Remover template"
        description="Tem certeza que deseja remover este template?"
        onConfirm={() => { if (deleteId) deleteTemplate.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        loading={deleteTemplate.isPending}
      />
    </>
  );
}
