import { useState } from "react";
import { usePortalTokens } from "@/hooks/usePortalTokens";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";

export function PortalLinkDialog({ clientId, trigger }: { clientId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { tokens, create, revoke } = usePortalTokens(clientId);

  const linkFor = (token: string) => `${window.location.origin}/portal/${token}`;
  const copy = (token: string) => { navigator.clipboard.writeText(linkFor(token)); toast.success("Link copiado"); };
  const active = tokens.filter((t) => !t.revoked);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline"><Link2 className="h-3 w-3 mr-1" /> Portal</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Link do Portal do Cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Button onClick={() => create.mutate({ client_id: clientId })} disabled={create.isPending} className="w-full">Gerar novo link</Button>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link ativo.</p>}
          {active.map((t) => (
            <div key={t.id} className="border rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={linkFor(t.token)} readOnly className="text-xs" />
                <Button size="icon" variant="ghost" onClick={() => copy(t.token)}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => revoke.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Criado em {new Date(t.created_at).toLocaleString("pt-BR")}
                {t.last_accessed_at && <> · Último acesso: {new Date(t.last_accessed_at).toLocaleString("pt-BR")}</>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}