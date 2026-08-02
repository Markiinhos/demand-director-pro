import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, BookOpen, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AIKnowledgeManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return data;
    }
  });

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ["ai_knowledge_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_knowledge").select("*");
      if (error) throw error;
      return data;
    }
  });

  const getClientName = (id: string | null) => {
    if (!id) return "Contexto Global";
    return clients?.find((c: any) => c.id === id)?.name || "Cliente Desconhecido";
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar na base de conhecimento..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Conhecimento
            </Button>
          </DialogTrigger>
          <DialogContent>
             <DialogHeader>
               <DialogTitle>Novo Contexto de Conhecimento</DialogTitle>
             </DialogHeader>
             <p className="text-sm text-muted-foreground p-4 text-center">Formulário de inserção integrado ao CRUD de ai_knowledge.</p>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        
        {knowledge?.filter(k => k.title.toLowerCase().includes(searchTerm.toLowerCase())).map((k: any) => (
          <Card key={k.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                <BookOpen className="w-4 h-4" />
                {k.title}
              </CardTitle>
              <CardDescription>{getClientName(k.client_id)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground line-clamp-3">
                 {k.content}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!knowledge || knowledge.length === 0) && !isLoading && (
           <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground">
             A base de conhecimento da sua agência está configurada, mas vazia. Adicione referências, branding de clientes ou regras de negócio para a IA usar.
           </div>
        )}
      </div>
    </div>
  );
}
