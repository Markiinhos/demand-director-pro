import { useState } from "react";
import { useDemandVersions } from "@/hooks/useDemandVersions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { getSignedFileUrl } from "@/lib/storage";

export function DemandVersionsDialog({ demandId, trigger }: { demandId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { versions, feedback, upload } = useDemandVersions(open ? demandId : undefined);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!file) return toast.error("Escolha um arquivo");
    await upload.mutateAsync({ file, notes });
    setFile(null); setNotes("");
  };

  const openSigned = async (urlOrPath: string) => {
    const u = await getSignedFileUrl(urlOrPath);
    if (!u) return toast.error("Arquivo indisponível");
    window.open(u, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline">Versões</Button>}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Versões e aprovações</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 border rounded p-3">
            <p className="text-sm font-medium">Enviar nova versão</p>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Textarea placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <Button onClick={submit} disabled={upload.isPending} size="sm"><Upload className="h-3 w-3 mr-1" /> Enviar</Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Versões enviadas</p>
            {versions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>}
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <div>
                  <Badge variant="outline">V{v.version_number}</Badge> <span className="ml-2">{v.file_name}</span>
                  {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                </div>
                {v.file_url && (
                  <Button size="sm" variant="ghost" onClick={() => openSigned(v.file_url!)}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Histórico do cliente</p>
            {feedback.length === 0 && <p className="text-xs text-muted-foreground">Sem feedback ainda.</p>}
            {feedback.map((f) => (
              <div key={f.id} className="text-xs border-l-2 pl-2" style={{ borderColor: f.action === "approved" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                <span className="font-medium">{f.action === "approved" ? "✓ Aprovou" : f.action === "changes_requested" ? "↻ Pediu ajuste" : "Comentou"}</span>
                {f.author_name && ` — ${f.author_name}`}
                <span className="text-muted-foreground"> · {new Date(f.created_at).toLocaleString("pt-BR")}</span>
                {f.comment && <div className="text-muted-foreground">"{f.comment}"</div>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}