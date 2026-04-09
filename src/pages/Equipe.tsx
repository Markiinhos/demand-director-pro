import { useAgency } from "@/contexts/AgencyContext";
import { useState } from "react";
import { Plus, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamMember, TeamMemberType } from "@/types/agency";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

export default function Equipe() {
  const { team, setTeam, demands } = useAgency();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', type: 'employee' as TeamMemberType, email: '', specialty: '', ratePerDemand: '' });

  const handleCreate = () => {
    if (!form.name) return;
    const member: TeamMember = {
      id: Date.now().toString(),
      name: form.name, role: form.role, type: form.type, email: form.email,
      specialty: form.specialty || undefined,
      ratePerDemand: form.ratePerDemand ? Number(form.ratePerDemand) : undefined,
    };
    setTeam(prev => [...prev, member]);
    setForm({ name: '', role: '', type: 'employee', email: '', specialty: '', ratePerDemand: '' });
    setOpen(false);
  };

  const employees = team.filter(t => t.type === 'employee');
  const freelancers = team.filter(t => t.type === 'freelancer');

  const MemberCard = ({ member, i }: { member: TeamMember; i: number }) => {
    const memberDemands = demands.filter(d => d.assigneeId === member.id);
    const active = memberDemands.filter(d => d.status !== 'done').length;
    const done = memberDemands.filter(d => d.status === 'done').length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role}</p>
            {member.specialty && <p className="text-xs text-accent-foreground mt-0.5">{member.specialty}</p>}
          </div>
          <Badge variant={member.type === 'employee' ? 'default' : 'secondary'} className="shrink-0 ml-auto">
            {member.type === 'employee' ? 'CLT' : 'Freelancer'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-lg font-bold">{active}</p>
            <p className="text-[10px] text-muted-foreground">Ativas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-lg font-bold">{done}</p>
            <p className="text-[10px] text-muted-foreground">Feitas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-lg font-bold">{memberDemands.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
        {member.ratePerDemand && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
            R$ {member.ratePerDemand}/demanda
          </p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground text-sm">{team.length} membros</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />Novo Membro</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Membro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cargo</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as TeamMemberType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionário</SelectItem>
                      <SelectItem value="freelancer">Terceirizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              {form.type === 'freelancer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Especialidade</Label><Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} /></div>
                  <div><Label>Valor/Demanda</Label><Input type="number" value={form.ratePerDemand} onChange={e => setForm(f => ({ ...f, ratePerDemand: e.target.value }))} /></div>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Adicionar Membro</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos ({team.length})</TabsTrigger>
          <TabsTrigger value="employees">Funcionários ({employees.length})</TabsTrigger>
          <TabsTrigger value="freelancers">Terceirizados ({freelancers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.map((m, i) => <MemberCard key={m.id} member={m} i={i} />)}
          </div>
        </TabsContent>
        <TabsContent value="employees" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((m, i) => <MemberCard key={m.id} member={m} i={i} />)}
          </div>
        </TabsContent>
        <TabsContent value="freelancers" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {freelancers.map((m, i) => <MemberCard key={m.id} member={m} i={i} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
