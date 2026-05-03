import { useMemo, useState } from "react";
import { useContractTemplates, useContracts } from "@/hooks/useContracts";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Upload, Trash2, Download, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Contratos() {
  const { templates, upload, remove: removeTpl } = useContractTemplates();
  const { contracts, generate, remove: removeContract } = useContracts();
  const { clients } = useClients();

  const [openTpl, setOpenTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplFile, setTplFile] = useState<File | null>(null);

  const [openGen, setOpenGen] = useState(false);
  const [tplId, setTplId] = useState("");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [includeLogo, setIncludeLogo] = useState(true);

  const selectedTpl = useMemo(() => templates.find((t) => t.id === tplId), [templates, tplId]);
  const placeholders = (selectedTpl?.placeholders as string[] | undefined) ?? [];

  const submitTpl = async () => {
    if (!tplFile || !tplName) return toast.error("Preencha nome e arquivo");
    await upload.mutateAsync({ file: tplFile, name: tplName });
    setOpenTpl(false); setTplName(""); setTplFile(null);
  };

  const submitGen = async () => {
    if (!tplId || !clientId || !title) return toast.error("Preencha todos os campos");
    await generate.mutateAsync({ template_id: tplId, client_id: clientId, title, variables: vars, include_logo: includeLogo });
    setOpenGen(false); setTplId(""); setClientId(""); setTitle(""); setVars({}); setIncludeLogo(true);
  };

  const sendWhatsapp = (phone: string | null, url: string, title: string) => {
    if (!phone) return toast.error("Cliente sem telefone");
    const msg = encodeURIComponent(`Olá! Segue o contrato "${title}": ${url}`);
    const cleaned = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleaned}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contratos</h1>
        <p className="text-muted-foreground text-sm">Modelos com placeholders e contratos gerados em PDF</p>
      </div>

      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos">Contratos gerados</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos" className="space-y-3 mt-4">
          <Dialog open={openGen} onOpenChange={setOpenGen}>
            <DialogTrigger asChild>
              <Button disabled={templates.length === 0}><Plus className="h-4 w-4 mr-2" /> Gerar contrato</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Gerar contrato</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Modelo</Label>
                  <Select value={tplId} onValueChange={setTplId}>
                    <SelectTrigger><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
                    <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Título do contrato</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="include-logo" checked={includeLogo} onCheckedChange={(v) => setIncludeLogo(v === true)} />
                  <Label htmlFor="include-logo" className="text-sm cursor-pointer">Incluir logo do cliente no PDF</Label>
                </div>
                {placeholders.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-sm">Preencher variáveis</Label>
                    {placeholders.map((p) => (
                      <div key={p}>
                        <Label className="text-xs">{p}</Label>
                        <Input value={vars[p] ?? ""} onChange={(e) => setVars((v) => ({ ...v, [p]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={submitGen} disabled={generate.isPending}>Gerar PDF</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {contracts.map((c: any) => {
            const client = clients.find((x) => x.id === c.client_id);
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{client?.name}</p>
                  </div>
                  <Badge variant={c.status === "signed" ? "default" : "secondary"}>{c.status}</Badge>
                </CardHeader>
                <CardContent className="flex gap-2">
                  {c.generated_pdf_url && (
                    <>
                      <Button size="sm" variant="outline" asChild><a href={c.generated_pdf_url} target="_blank" rel="noreferrer"><Download className="h-3 w-3 mr-1" /> Baixar</a></Button>
                      <Button size="sm" variant="outline" onClick={() => sendWhatsapp(client?.phone ?? null, c.generated_pdf_url, c.title)}><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeContract.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </CardContent>
              </Card>
            );
          })}
          {contracts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato gerado.</p>}
        </TabsContent>

        <TabsContent value="modelos" className="space-y-3 mt-4">
          <Dialog open={openTpl} onOpenChange={setOpenTpl}>
            <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" /> Enviar modelo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo modelo de contrato</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={tplName} onChange={(e) => setTplName(e.target.value)} /></div>
                <div><Label>Arquivo (.docx ou .txt)</Label>
                  <Input type="file" accept=".docx,.txt" onChange={(e) => setTplFile(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground mt-1">Use placeholders {"{{nome}} {{cpf}} {{valor}} {{servico}} {{data}}"} no documento</p>
                </div>
              </div>
              <DialogFooter><Button onClick={submitTpl} disabled={upload.isPending}>Enviar</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t.file_name} • {(t.placeholders as string[]).length} variáveis</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeTpl.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              {(t.placeholders as string[]).length > 0 && (
                <CardContent className="flex flex-wrap gap-1">
                  {(t.placeholders as string[]).map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                </CardContent>
              )}
            </Card>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo enviado.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}