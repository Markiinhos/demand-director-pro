import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Loader2, Plus, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function AIComplianceManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: obligations, isLoading } = useQuery({
    queryKey: ["compliance_obligations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_obligations").select("*, clients(name)");
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
            placeholder="Buscar por obrigação (contratos, contábil, alvarás)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Obrigação
            </Button>
          </DialogTrigger>
          <DialogContent>
             <DialogHeader>
               <DialogTitle>Cadastrar Nova Obrigação / Compliance</DialogTitle>
             </DialogHeader>
             <p className="text-sm text-muted-foreground p-4 text-center">Formulário de cadastro em construção. Integrado com ai_compliance_obligations.</p>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        
        {obligations?.filter(o => o.title.toLowerCase().includes(searchTerm.toLowerCase())).map((obl: any) => (
          <Card key={obl.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                    <ShieldCheck className="w-4 h-4" />
                    {obl.title}
                  </CardTitle>
                  {obl.status === 'expired' && <AlertTriangle className="w-4 h-4 text-destructive" />}
              </div>
              <CardDescription>{obl.clients?.name || "Global"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                 <p><strong>Categoria:</strong> {obl.category}</p>
                 <p><strong>Vencimento:</strong> {obl.due_date ? format(new Date(obl.due_date), "dd/MM/yyyy") : 'N/A'}</p>
                 <p><strong>Status:</strong> {obl.status}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!obligations || obligations.length === 0) && !isLoading && (
           <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground">
             Nenhuma obrigação de compliance cadastrada. Acompanhe licenças, proteção de dados e alvarás aqui.
           </div>
        )}
      </div>
    </div>
  );
}
