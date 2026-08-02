import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  const { data: agent, isLoading } = useQuery({
    queryKey: ["ai_agent_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agents").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  useEffect(() => {
    if (agent) {
      setName(agent.name || "Demand Director OS AI");
      setPrompt(agent.system_prompt || "");
    }
  }, [agent]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      let reqError;
      if (agent?.id) {
         const { error } = await supabase.from("ai_agents").update({
           name, system_prompt: prompt
         }).eq("id", agent.id);
         reqError = error;
      } else {
         const { error } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) throw new Error("No session");
            return supabase.from("ai_agents").insert([{
              user_id: user.id,
              name,
              system_prompt: prompt,
              model: "gpt-4o-mini"
            }]);
         });
         reqError = error;
      }
      if (reqError) throw reqError;
    },
    onSuccess: () => {
      toast.success("Configurações do agente salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ai_agent_settings"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do Assistente</DialogTitle>
          <DialogDescription>
            Ajuste o comportamento e as bases de instrução do seu agente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
           <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Nome do Agente</Label>
              <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="system-prompt">Prompt de Sistema</Label>
              <Textarea 
                id="system-prompt" 
                className="resize-none h-32"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Você é um assistente encarregado de ajudar a gestão da agência..." 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo de IA Padrão (Env)</Label>
              <Input id="model" defaultValue={agent?.model || "gpt-4o-mini"} disabled />
              <p className="text-[10px] text-muted-foreground">Configurado remotamente via variável de ambiente nas Edge Functions (OPENAI_API_KEY).</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveSettings.isPending}>Cancelar</Button>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Preferências
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
