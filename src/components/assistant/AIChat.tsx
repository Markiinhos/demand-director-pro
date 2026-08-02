import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAIAgent } from "@/hooks/useAIAgent";

export default function AIChat() {
  const { messages, loadingMessages, sendMessage } = useAIAgent();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input.trim());
    setInput("");
  };

  if (loadingMessages) {
    return <div className="p-8 text-center text-muted-foreground flex items-center justify-center h-full gap-2"><Loader2 className="animate-spin w-4 h-4" /> Carregando Histórico...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {(!messages || messages.length === 0) && (
            <div className="text-center text-muted-foreground mt-8 text-sm">
              <Sparkles className="w-8 h-8 opacity-20 mx-auto mb-2" />
              Nenhuma conversa ativa. Envie uma mensagem para iniciar.
            </div>
          )}

          {messages?.map((msg: any) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <Avatar className="w-8 h-8 shrink-0 bg-primary/10 text-primary">
                  <AvatarFallback><Sparkles className="w-4 h-4" /></AvatarFallback>
                </Avatar>
              )}
              
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-card border text-card-foreground rounded-tl-sm'
              }`}>
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">EU</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-3 justify-start">
              <Avatar className="w-8 h-8 shrink-0 bg-primary/10 text-primary">
                <AvatarFallback><Sparkles className="w-4 h-4" /></AvatarFallback>
              </Avatar>
              <div className="px-5 py-3.5 rounded-2xl bg-card border text-muted-foreground rounded-tl-sm shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm">Pensando e Validando Ações...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Peça-me para analisar um cliente, listar demandas ou criar conteúdo..."
            className="pr-12 py-6 rounded-full bg-background border-border shadow-sm focus-visible:ring-primary/20"
            disabled={sendMessage.isPending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="absolute right-2 rounded-full w-9 h-9 shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
