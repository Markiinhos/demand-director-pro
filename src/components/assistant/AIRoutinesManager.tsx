import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Loader2, Plus, Clock, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AIRoutinesManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: routines, isLoading } = useQuery({
    queryKey: ["ai_routines_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_routines").select("*, clients(name)");
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar rotinas automatizadas..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Rotina
            </Button>
          </DialogTrigger>
          <DialogContent>
             <DialogHeader>
               <DialogTitle>Configurar Rotina Automática</DialogTitle>
             </DialogHeader>
             <p className="text-sm text-muted-foreground p-4 text-center">Formulário de cadastro integrado com ai_routines (Ex: Cobrança Mensal, Lembretes).</p>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        
        {routines?.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map((rou: any) => (
          <Card key={rou.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                    <Clock className="w-4 h-4" />
                    {rou.name}
                  </CardTitle>
              </div>
              <CardDescription>{rou.clients?.name || "Global"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-2">
                 <p><strong>Tipo:</strong> {rou.routine_type}</p>
                 <p><strong>Agendamento (Cron):</strong> {rou.schedule}</p>
                 {rou.requires_approval ? (
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-medium">Requer Aprovação Manual</span>
                 ) : (
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-medium">Cron Ativado</span>
                 )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!routines || routines.length === 0) && !isLoading && (
           <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground">
             Nenhuma rotina configurada. Automatize cobranças e mensagens no dia correto.
           </div>
        )}
      </div>
    </div>
  );
}
