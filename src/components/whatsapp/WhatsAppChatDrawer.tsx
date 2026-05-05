import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import {
  MessageCircle, Send, Loader2, FileText, Receipt, FileSignature,
  ClipboardList, CheckCheck, Check, Clock, AlertCircle, Image,
} from "lucide-react";

interface WhatsAppChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  phone: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  defaultMessage?: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3 w-3 text-muted-foreground" />,
  sent: <Check className="h-3 w-3 text-muted-foreground" />,
  delivered: <CheckCheck className="h-3 w-3 text-info" />,
  read: <CheckCheck className="h-3 w-3 text-emerald-500" />,
  failed: <AlertCircle className="h-3 w-3 text-destructive" />,
  received: <MessageCircle className="h-3 w-3 text-primary" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-3 w-3" />,
  payment: <Receipt className="h-3 w-3" />,
  contract: <FileSignature className="h-3 w-3" />,
  budget: <ClipboardList className="h-3 w-3" />,
  image: <Image className="h-3 w-3" />,
  template: <FileText className="h-3 w-3" />,
};

export function WhatsAppChatDrawer({
  open, onOpenChange, clientId, clientName, phone,
  relatedEntityType, relatedEntityId, defaultMessage = "",
}: WhatsAppChatDrawerProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [sendMode, setSendMode] = useState<"text" | "template">("text");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage, sendTemplateMessage } = useWhatsAppMessages(clientId);
  const { templates, isConnected } = useWhatsAppConnection();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (sendMode === "template" && selectedTemplate) {
      const tmpl = templates.find(t => t.template_key === selectedTemplate);
      if (tmpl) {
        sendTemplateMessage.mutate({
          clientId,
          phone,
          templateName: tmpl.name,
          templateKey: tmpl.template_key,
          relatedEntityType,
          relatedEntityId,
        });
      }
      return;
    }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSending = sendMessage.isPending || sendTemplateMessage.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-sm">{clientName}</span>
              <p className="text-[10px] text-muted-foreground font-normal">{phone}</p>
            </div>
            {!isConnected && (
              <Badge variant="destructive" className="text-[9px] ml-auto">Sem conexão</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-20 mb-2" />
              <p className="text-sm">Nenhuma mensagem</p>
              <p className="text-[10px]">Envie a primeira mensagem para iniciar a conversa</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`max-w-[85%] ${
                  msg.direction === "outbound"
                    ? "ml-auto"
                    : "mr-auto"
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    msg.direction === "outbound"
                      ? "bg-emerald-600 text-white rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {/* Type indicator */}
                  {msg.message_type !== "text" && (
                    <div className={`flex items-center gap-1 text-[10px] mb-1 ${
                      msg.direction === "outbound" ? "text-white/70" : "text-muted-foreground"
                    }`}>
                      {typeIcons[msg.message_type]}
                      <span className="capitalize">{msg.message_type}</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                  {msg.media_url && (
                    <div className={`mt-1 text-[10px] flex items-center gap-1 ${
                      msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"
                    }`}>
                      <FileText className="h-3 w-3" />
                      Anexo
                    </div>
                  )}
                </div>

                {/* Status + time */}
                <div className={`flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground ${
                  msg.direction === "outbound" ? "justify-end" : "justify-start"
                }`}>
                  <span>
                    {new Date(msg.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  {msg.direction === "outbound" && statusIcons[msg.status]}
                </div>

                {msg.error_message && (
                  <p className={`text-[10px] text-destructive mt-0.5 ${
                    msg.direction === "outbound" ? "text-right" : ""
                  }`}>
                    {msg.error_message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 border-t border-border/50 shrink-0 space-y-2">
          {/* Send mode selector */}
          <div className="flex gap-1">
            <button
              onClick={() => setSendMode("text")}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                sendMode === "text"
                  ? "bg-emerald-500/10 text-emerald-600 font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Texto Livre
            </button>
            <button
              onClick={() => setSendMode("template")}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                sendMode === "template"
                  ? "bg-emerald-500/10 text-emerald-600 font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Template
            </button>
          </div>

          <div className="flex gap-2">
            {sendMode === "template" ? (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="flex-1 text-sm">
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.template_key} value={t.template_key}>{t.name}</SelectItem>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-xs text-muted-foreground px-2 py-1">Nenhum template cadastrado</div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm"
              />
            )}
            <Button
              onClick={handleSend}
              size="icon"
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
              disabled={
                isSending ||
                (sendMode === "text" && !message.trim()) ||
                (sendMode === "template" && !selectedTemplate)
              }
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
