import { useState } from "react";
import { useBriefings, BriefingField } from "@/hooks/useBriefings";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FIELDS: BriefingField[] = [
  { id: "objetivo", label: "Qual o objetivo do projeto?", type: "textarea", required: true },
  { id: "publico", label: "Quem é o público-alvo?", type: "textarea" },
  { id: "referencias", label: "Referências (links, marcas que admira)", type: "textarea" },
  { id: "prazo", label: "Prazo desejado", type: "text" },
  { id: "orcamento", label: "Orçamento previsto", type: "text" },
];

export default function Briefings() {
  const { briefings, create, remove } = useBriefings();
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [fields, setFields] = useState<BriefingField[]>(DEFAULT_FIELDS);

  const addField = () => setFields((f) => [...f, { id: `campo_${f.length + 1}`, label: "", type: "text" }]);
  const updateField = (i: number, patch: Partial<BriefingField>) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title) return toast.error("Informe um título");
    await create.mutateAsync({
      title, description: description || null,
      client_id: clientId || null, demand_id: null,
      schema: fields, status: "sent" as const, expires_at: null,
    });
    setOpen(false); setTitle(""); setDescription(""); setClientId(""); setFields(DEFAULT_FIELDS);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/briefing/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Briefings</h1>
          <p className="text-muted-foreground text-sm">Envie um link e o cliente preenche antes do projeto</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo briefing</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo briefing</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
              <div>
                <Label>Cliente (opcional)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Perguntas</Label>
                  <Button size="sm" variant="outline" onClick={addField}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                {fields.map((f, i) => (
                  <div key={i} className="border rounded p-2 space-y-2">
                    <div className="grid grid-cols-[1fr_140px_auto] gap-2">
                      <Input placeholder="Pergunta" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
                      <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as BriefingField["type"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto curto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="select">Lista</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => removeField(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={create.isPending}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {briefings.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{b.title}</CardTitle>
                {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
              </div>
              <Badge variant={b.status === "answered" ? "default" : "secondary"}>{b.status}</Badge>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyLink(b.token)}><Copy className="h-3 w-3 mr-1" /> Copiar link</Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)}><Trash2 className="h-3 w-3" /></Button>
            </CardContent>
          </Card>
        ))}
        {briefings.length === 0 && <p className="text-muted-foreground text-sm">Nenhum briefing criado.</p>}
      </div>
    </div>
  );
}