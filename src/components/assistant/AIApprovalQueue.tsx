import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ScrollText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AIApprovalQueue() {
  const queryClient = useQueryClient();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["ai_approvals_queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_actions")
        .select("*")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const mutateStatus = useMutation({
    mutationFn: async ({ id, status, func }: { id: string, status: string, func: string }) => {
      // Stub execution if Approved (real functionality should call an Edge Function ai-approve-action)
      const updates: any = { status };
      if (status === 'executed') {
         updates.executed_at = new Date().toISOString();
         updates.approved_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from("ai_actions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_approvals_queue"] });
      queryClient.invalidateQueries({ queryKey: ["ai_pending_actions_brief"] });
      queryClient.invalidateQueries({ queryKey: ["ai_activity_log"] });
      toast.success("Ação processada com sucesso.");
    }
  });

  if (isLoading) return <div className="text-center p-8 text-sm text-muted-foreground">Carregando Fila...</div>;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ação / Ferramenta</TableHead>
            <TableHead>Argumentos Gerados</TableHead>
            <TableHead>Nível de Risco</TableHead>
            <TableHead>Data Criação</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals?.map((item: any) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.tool_name}</TableCell>
              <TableCell className="text-xs font-mono max-w-[200px] truncate text-muted-foreground">
                 {JSON.stringify(item.arguments)}
              </TableCell>
              <TableCell>
                <Badge variant={item.risk_level === 'high' ? 'destructive' : 'secondary'}>
                  {item.risk_level === 'high' ? 'Alto' : 'Médio'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(item.created_at), "dd/MM HH:mm")}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                    size="icon" 
                    title="Excluir/Rejeitar"
                    variant="ghost" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => mutateStatus.mutate({ id: item.id, status: 'rejected', func: item.tool_name })}
                    disabled={mutateStatus.isPending}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
                <Button 
                    size="icon"
                    title="Aprovar e Executar" 
                    variant="ghost" 
                    className="text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => mutateStatus.mutate({ id: item.id, status: 'executed', func: item.tool_name })}
                    disabled={mutateStatus.isPending}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {(!approvals || approvals.length === 0) && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <ScrollText className="w-8 h-8 opacity-20 mx-auto mb-2" />
                Fila limpa. Nenhuma ação pendente de aprovação.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
