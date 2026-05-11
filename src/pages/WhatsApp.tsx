import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useWhatsAppMessages, WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useClients } from "@/hooks/useClients";
import { useQueryClient } from "@tanstack/react-query";
import { WhatsAppChatDrawer } from "@/components/whatsapp/WhatsAppChatDrawer";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";
import { WhatsAppTemplatesCard } from "@/components/whatsapp/WhatsAppTemplatesCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageCircle, Search, Loader2, Send, FileText, Phone,
  Users, Settings, CheckCheck, Check, Clock, AlertCircle,
  Receipt, FileSignature, ClipboardList, Zap,
} from "lucide-react";

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3 w-3 text-muted-foreground" />,
  sent: <Check className="h-3 w-3 text-muted-foreground" />,
  delivered: <CheckCheck className="h-3 w-3 text-info" />,
  read: <CheckCheck className="h-3 w-3 text-emerald-500" />,
  failed: <AlertCircle className="h-3 w-3 text-destructive" />,
  received: <MessageCircle className="h-3 w-3 text-primary" />,
};

const statusLabels: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  received: "Recebido",
};

export default function WhatsApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const callbackHandled = useRef(false);

  const { messages, isLoading: loadingMsgs } = useWhatsAppMessages();
  const { isConnected } = useWhatsAppConnection();
  const { clients, isLoading: loadingClients } = useClients();
  const [search, setSearch] = useState("");
  const [chatClient, setChatClient] = useState<{ id: string; name: string; phone: string } | null>(null);

  // ── Handle OAuth callback return ──────────────────────
  useEffect(() => {
    if (callbackHandled.current) return;

    const connected = searchParams.get("whatsapp_connected");
    const error = searchParams.get("whatsapp_error");

    // Also support legacy param format
    const legacyWhatsapp = searchParams.get("whatsapp");

    if (connected === "true" || legacyWhatsapp === "connected") {
      callbackHandled.current = true;
      console.log("✅ [WhatsApp] Callback detected: connection successful!");
      toast.success("WhatsApp Business conectado com sucesso! 🎉", {
        description: "Sua conta foi vinculada. Atualizando dados...",
        duration: 5000,
      });
      // Force refetch connection data
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      // Clean up URL params
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete("whatsapp_connected");
      cleanParams.delete("whatsapp_error");
      cleanParams.delete("whatsapp");
      cleanParams.delete("message");
      setSearchParams(cleanParams, { replace: true });
    } else if (connected === "false" || error || legacyWhatsapp === "error") {
      callbackHandled.current = true;
      const errorMsg = error || searchParams.get("message") || "Erro desconhecido";
      console.error("❌ [WhatsApp] Callback detected: connection failed:", errorMsg);
      toast.error("Falha ao conectar WhatsApp", {
        description: errorMsg,
        duration: 8000,
      });
      // Clean up URL params
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete("whatsapp_connected");
      cleanParams.delete("whatsapp_error");
      cleanParams.delete("whatsapp");
      cleanParams.delete("message");
      setSearchParams(cleanParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Group messages by client (most recent first)
  const conversations = useMemo(() => {
    const map = new Map<string, {
      clientId: string;
      clientName: string;
      phone: string;
      lastMessage: WhatsAppMessage;
      unread: number;
      messages: number;
    }>();

    for (const msg of messages) {
      const existing = map.get(msg.client_id);
      const client = clients.find(c => c.id === msg.client_id);
      const clientName = client?.name || "Cliente desconhecido";
      const phone = client?.phone || "";

      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
        map.set(msg.client_id, {
          clientId: msg.client_id,
          clientName,
          phone,
          lastMessage: msg,
          unread: (existing?.unread || 0) + (msg.direction === "inbound" && msg.status === "received" ? 1 : 0),
          messages: (existing?.messages || 0) + 1,
        });
      } else {
        existing.unread += msg.direction === "inbound" && msg.status === "received" ? 1 : 0;
        existing.messages += 1;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, clients]);

  // Clients with phone but no conversation yet
  const availableClients = useMemo(() => {
    const conversationClientIds = new Set(conversations.map(c => c.clientId));
    return clients
      .filter(c => c.phone && !conversationClientIds.has(c.id))
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.phone || "").includes(q);
      });
  }, [clients, conversations, search]);

  const filteredConversations = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.clientName.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [conversations, search]);

  // Stats
  const totalSent = messages.filter(m => m.direction === "outbound").length;
  const totalReceived = messages.filter(m => m.direction === "inbound").length;
  const totalFailed = messages.filter(m => m.status === "failed").length;

  const isLoading = loadingMsgs || loadingClients;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-emerald-600" />
            WhatsApp Business
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie conversas, envie cobranças, contratos e propostas pelo WhatsApp.
          </p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Conectado
          </Badge>
        )}
      </div>

      {/* Stats */}
      {isConnected && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Conversas", value: conversations.length, icon: Users, color: "text-primary" },
            { label: "Enviadas", value: totalSent, icon: Send, color: "text-emerald-600" },
            { label: "Recebidas", value: totalReceived, icon: MessageCircle, color: "text-info" },
            { label: "Falhas", value: totalFailed, icon: AlertCircle, color: "text-destructive" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue={isConnected ? "conversas" : "config"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversas" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />Conversas
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />Contatos
          </TabsTrigger>
          <TabsTrigger value="automacao" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />Automação
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />Configurações
          </TabsTrigger>
        </TabsList>

        {/* CONVERSATIONS TAB */}
        <TabsContent value="conversas" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-9"
            />
          </div>

          {!isConnected ? (
            <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <h3 className="font-semibold text-lg mb-1">WhatsApp não configurado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte seu WhatsApp Business na aba Configurações para começar a conversar.
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
              <h3 className="font-semibold mb-1">Nenhuma conversa</h3>
              <p className="text-sm text-muted-foreground">
                Inicie uma conversa pela aba Contatos clicando no botão WhatsApp.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden divide-y divide-border/30">
              {filteredConversations.map(conv => (
                <button
                  key={conv.clientId}
                  onClick={() => setChatClient({ id: conv.clientId, name: conv.clientName, phone: conv.phone })}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{conv.clientName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(conv.lastMessage.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {conv.lastMessage.direction === "outbound" && statusIcons[conv.lastMessage.status]}
                        {conv.lastMessage.content?.substring(0, 60) || "[mídia]"}
                      </p>
                      {conv.unread > 0 && (
                        <span className="h-5 min-w-[20px] rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center px-1.5 shrink-0">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contatos" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contato..."
              className="pl-9"
            />
          </div>

          <div className="bg-card border border-border/50 rounded-xl overflow-hidden divide-y divide-border/30">
            {clients.filter(c => c.phone).filter(c => {
              if (!search) return true;
              const q = search.toLowerCase();
              return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
            }).map(client => (
              <div key={client.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{client.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{client.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChatClient({ id: client.id, name: client.name, phone: client.phone! })}
                    className="gap-1.5"
                    disabled={!isConnected}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                  </Button>
                </div>
              </div>
            ))}
            {clients.filter(c => c.phone).length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Nenhum contato com telefone cadastrado</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* AUTOMATION TAB */}
        <TabsContent value="automacao" className="space-y-4">
          <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Automações</h3>
              <Badge variant="secondary" className="text-[10px]">MVP</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Configure disparos automáticos de mensagens via templates aprovados.
            </p>

            <div className="space-y-3">
              {[
                { label: "Lembrete de cobrança antes do vencimento", icon: Clock, status: "manual" },
                { label: "Notificação de cobrança vencida", icon: Receipt, status: "manual" },
                { label: "Envio automático de contrato assinado", icon: FileSignature, status: "manual" },
                { label: "Envio automático de proposta/orçamento", icon: ClipboardList, status: "manual" },
                { label: "Confirmação de pagamento recebido", icon: CheckCheck, status: "manual" },
                { label: "Follow-up de orçamento sem resposta", icon: Send, status: "futuro" },
              ].map((auto, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <auto.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{auto.label}</span>
                  </div>
                  <Badge variant={auto.status === "manual" ? "outline" : "secondary"} className="text-[10px]">
                    {auto.status === "manual" ? "Disparo manual" : "Em breve"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="bg-info/5 border border-info/20 rounded-lg p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Nota:</strong> No MVP, todas as automações são disparadas manualmente.
              No futuro, será possível configurar agendamentos automáticos com gatilhos (ex: 2 dias antes do vencimento).
            </div>
          </div>
        </TabsContent>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-4">
          <WhatsAppConnectionCard />
          <WhatsAppTemplatesCard />
        </TabsContent>
      </Tabs>

      {/* Chat Drawer */}
      {chatClient && (
        <WhatsAppChatDrawer
          open={!!chatClient}
          onOpenChange={() => setChatClient(null)}
          clientId={chatClient.id}
          clientName={chatClient.name}
          phone={chatClient.phone}
        />
      )}
    </div>
  );
}
