import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, CheckCircle2, AlertCircle, Bot, Key, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function ChatGPTIntegration() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  async function loadIntegrations() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("chatgpt_integrations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setIntegrations(data);
    setLoading(false);
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function generateKey() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data, error } = await supabase.functions.invoke("chatgpt-keys", {
      method: "POST",
      body: { name: `GPT Actions ${new Date().toLocaleDateString("pt-BR")}` }
    });

    if (error || !data?.success) {
       toast.error("Erro ao gerar chave.");
       setLoading(false);
       return;
    }

    setGeneratedKey(data.raw_key);
    setShowKeyDialog(true);
    loadIntegrations();
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
     const { error } = await supabase.from("chatgpt_integrations").update({ is_active: !currentStatus }).eq("id", id);
     if (error) {
       toast.error("Erro ao alterar status");
       return;
     }
     loadIntegrations();
     toast.success(currentStatus ? "Desativado" : "Ativado");
  }

  async function revoke(id: string) {
     const { error } = await supabase.from("chatgpt_integrations").update({ revoked_at: new Date().toISOString(), is_active: false }).eq("id", id);
     if (error) {
       toast.error("Erro ao revogar chave");
       return;
     }
     loadIntegrations();
     toast.success("Chave revogada.");
  }

  const openApiUrl = `${window.location.origin}/chatgpt-actions-openapi.yaml`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2">Custom GPT (ChatGPT Actions)</h2>
            <p className="text-sm text-muted-foreground">
              Conecte um Custom GPT ao painel usando Actions para consultar e executar ações operacionais.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(openApiUrl, "URL OpenAPI")}>
               Copiar URL OpenAPI
            </Button>
            <Button size="sm" onClick={generateKey}>
               <Key className="w-4 h-4 mr-2" />
               Gerar Nova Chave
            </Button>
        </div>
      </div>

      {loading ? (
         <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3 mt-4">
          {integrations.length === 0 && (
             <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chave gerada.</p>
          )}
          {integrations.map((int) => (
             <div key={int.id} className="flex flex-col sm:flex-row justify-between p-3 border rounded-md items-start sm:items-center gap-3">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{int.name}</span>
                      {int.revoked_at ? (
                         <Badge variant="destructive">Revogada</Badge>
                      ) : int.is_active ? (
                         <Badge variant="default" className="bg-green-600">Ativa</Badge>
                      ) : (
                         <Badge variant="secondary">Inativa</Badge>
                      )}
                   </div>
                   <div className="text-xs text-muted-foreground space-y-1">
                      <p>Prefixo: <code className="bg-muted px-1 rounded">{int.key_prefix}...</code></p>
                      <p>Criada em: {new Date(int.created_at).toLocaleString()}</p>
                      <p>Último uso: {int.last_used_at ? new Date(int.last_used_at).toLocaleString() : "Nunca"}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   {!int.revoked_at && (
                     <div className="flex items-center gap-2 mr-3">
                        <Label htmlFor={`active-${int.id}`} className="text-xs">Ativa</Label>
                        <Switch id={`active-${int.id}`} checked={int.is_active} onCheckedChange={() => toggleStatus(int.id, int.is_active)} />
                     </div>
                   )}
                   <Button variant="ghost" size="sm" onClick={() => revoke(int.id)} title="Revogar permanentemente">
                      <Trash2 className="w-4 h-4 text-destructive" />
                   </Button>
                </div>
             </div>
          ))}
        </div>
      )}

      {/* Instruções */}
      <div className="bg-muted/30 p-4 rounded-md text-sm text-muted-foreground mt-4">
        <h4 className="font-semibold text-foreground mb-2">Instruções para o GPT:</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Crie um <strong>Custom GPT</strong> no ChatGPT.</li>
          <li>Em <em>Configure</em>, clique em <strong>Create new action</strong>.</li>
          <li>Cole a URL do OpenAPI em <strong>Import from URL</strong> e clique em Import.</li>
          <li>Configure a <strong>Authentication</strong> com tipo <strong>API Key</strong> e cole sua chave gerada aqui. Use <strong>Bearer</strong> ou customizado (a API espera <code className="px-1 bg-muted/50 rounded">Bearer sk-saas-...</code>).</li>
          <li>Preencha as instruções do seu GPT avisando que ações de alto risco exigirão confirmação pelo painel.</li>
        </ol>
      </div>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sua Chave de Integração</DialogTitle>
            <DialogDescription>
              Copie esta chave agora. Por motivos de segurança, ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-card border p-3 rounded flex justify-between items-center break-all text-sm font-mono mt-2">
             <span>{generatedKey}</span>
             <Button variant="ghost" size="icon" onClick={() => copyToClipboard(generatedKey || "", "Chave")}><Copy className="w-4 h-4" /></Button>
          </div>
          <Alert className="mt-4 border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs text-left">
               Nunca compartilhe esta chave. Ela permite acesso aos dados dos seus clientes e finanças.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={() => setGeneratedKey(null)}>Fechei e já copiei</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
