import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  phone: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  defaultMessage?: string;
}

const statusColors: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success",
  read: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  received: "bg-primary/10 text-primary",
};

const statusLabels: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  received: "Recebido",
};

export function WhatsAppDialog({
  open, onOpenChange, clientId, clientName, phone,
  relatedEntityType, relatedEntityId, defaultMessage = "",
}: WhatsAppDialogProps) {
  const [message, setMessage] = useState(defaultMessage);
  const { messages, sendMessage } = useWhatsAppMessages(clientId);

  const handleSend = () => {
    if (!message.trim() || !phone) return;
    sendMessage.mutate({
      clientId,
      content: message,
      phone,
      relatedEntityType,
      relatedEntityId,
    }, {
      onSuccess: () => setMessage(""),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            WhatsApp - {clientName}
          </DialogTitle>
        </DialogHeader>

        {/* Message history */}
        <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem</p>
          ) : (
            messages.slice(0, 20).map(msg => (
              <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.direction === 'outbound' ? 'bg-success/5 ml-4' : 'bg-muted/40 mr-4'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    {msg.direction === 'outbound' ? '→ Enviado' : '← Recebido'}
                  </span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${statusColors[msg.status] || ''}`}>
                    {statusLabels[msg.status] || msg.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p>{msg.content}</p>
                {msg.error_message && (
                  <p className="text-[10px] text-destructive mt-1">{msg.error_message}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Send form */}
        <div className="space-y-3">
          <div>
            <Label>Telefone</Label>
            <Input value={phone} disabled className="text-sm" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={3}
            />
          </div>
          <Button onClick={handleSend} className="w-full" disabled={sendMessage.isPending || !message.trim()}>
            {sendMessage.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Enviando...</>
            ) : (
              <><Send className="h-4 w-4 mr-1.5" />Enviar Mensagem</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
