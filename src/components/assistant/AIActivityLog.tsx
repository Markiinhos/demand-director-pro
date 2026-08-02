import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, PlayCircle, Loader2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function AIActivityLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai_activity_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="bg-card border rounded-xl overflow-hidden h-[600px] flex flex-col">
      <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Log de Auditoria e Ações</h3>
          <p className="text-sm text-muted-foreground">Registro de todas as ações solicitadas pelo assistente.</p>
        </div>
      </div>
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {isLoading && <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />}
          
          {(!logs || logs.length === 0) && !isLoading && (
             <div className="text-sm text-center text-muted-foreground p-8">Nenhum evento registrado ainda no log de ações da IA.</div>
          )}

          {logs?.map((item: any, index: number) => (
            <div key={item.id} className="relative pl-6 pb-6">
              {index !== logs.length - 1 && (
                <div className="absolute left-2.5 top-6 bottom-0 w-px bg-border -ml-[0.5px]" />
              )}
              <div className="absolute left-0 top-1 rounded-full bg-background">
                {item.status === 'executed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 bg-background" />
                ) : (item.status === 'pending' || item.status === 'pending_approval') ? (
                  <Clock className="w-5 h-5 text-amber-500 bg-background" />
                ) : item.status === 'rejected' ? (
                  <XCircle className="w-5 h-5 text-destructive bg-background" />
                ) : (
                  <PlayCircle className="w-5 h-5 text-primary bg-background" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {item.status === 'executed' ? 'Ação Executada' : 
                     item.status === 'rejected' ? 'Ação Rejeitada e Cancelada' : 
                     item.status === 'pending_approval' ? 'Na fila de aprovação' : 'Em processamento...' }
                  </span>
                  <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd/MM HH:mm:ss")}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted inline-flex px-2 py-0.5 rounded">
                  {item.tool_name}
                </div>
                {item.arguments && Object.keys(item.arguments).length > 0 && (
                   <div className="mt-1 text-[10px] bg-muted/30 p-2 rounded text-muted-foreground font-mono">
                     Payload: {JSON.stringify(item.arguments)}
                   </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
