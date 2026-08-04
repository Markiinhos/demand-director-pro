import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, ShieldPlus } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppAuthorizedNumbers() {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("manager");
  const [clientId, setClientId] = useState("none");

  const loadNumbers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("whatsapp_authorized_numbers").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setNumbers(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadNumbers(); }, []);

  const addNumber = async () => {
    if (!phone || !name) return toast.error("Preencha telefone e nome.");
    const cleanPhone = phone.replace(/\D/g, "");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("whatsapp_authorized_numbers").insert({
      user_id: user.id,
      phone_number: cleanPhone,
      display_name: name,
      access_role: role,
      client_id: role === "client" && clientId !== "none" ? clientId : null,
      is_active: true
    });

    if (error) {
      toast.error("Erro ao adicionar número.");
      console.error(error);
    } else {
      toast.success("Número autorizado com sucesso!");
      setPhone(""); setName(""); setRole("manager"); setClientId("none");
      loadNumbers();
    }
  };

  const removeNumber = async (id: string) => {
    const { error } = await supabase.from("whatsapp_authorized_numbers").delete().eq("id", id);
    if (!error) {
      toast.success("Removido com sucesso.");
      loadNumbers();
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-5 space-y-5">
       <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldPlus className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
             <h2 className="font-semibold">Números Autorizados (Controle de IA)</h2>
             <p className="text-sm text-muted-foreground">Define quem pode dar comandos ao agente inteligente via WhatsApp e as permissões de cada um.</p>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-muted/20 p-4 rounded-lg">
         <div className="space-y-1">
           <Label className="text-xs">Telefone (DDD+Número)</Label>
           <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="5511999999999" />
         </div>
         <div className="space-y-1">
           <Label className="text-xs">Nome</Label>
           <Input value={name} onChange={e => setName(e.target.value)} placeholder="João/Diretor" />
         </div>
         <div className="space-y-1">
           <Label className="text-xs">Papel</Label>
           <Select value={role} onValueChange={setRole}>
             <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>
                <SelectItem value="owner">Owner (Admin Total)</SelectItem>
                <SelectItem value="manager">Manager (Operacional)</SelectItem>
                <SelectItem value="collaborator">Colaborador</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
             </SelectContent>
           </Select>
         </div>
         <div className="space-y-1">
           <Label className="text-xs">Cliente Vinculado</Label>
           <Select value={clientId} onValueChange={setClientId} disabled={role !== "client"}>
             <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
             </SelectContent>
           </Select>
         </div>
         <Button onClick={addNumber} className="w-full gap-2"><UserPlus className="w-4 h-4" /> Adicionar</Button>
       </div>

       <div className="space-y-2 mt-4">
         {numbers.map(n => (
           <div key={n.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                   {n.display_name} <Badge variant="outline">{n.access_role}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">{n.phone_number}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeNumber(n.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
           </div>
         ))}
         {numbers.length === 0 && !loading && <div className="text-center text-sm text-muted-foreground py-4">Nenhum número cadastrado.</div>}
       </div>
    </div>
  );
}
