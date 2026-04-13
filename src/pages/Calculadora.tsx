import { useState, useMemo, useEffect } from "react";
import { Calculator, DollarSign, Clock, Briefcase, Plus, Trash2, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useFreelancerSettings, CostItem } from "@/hooks/useFreelancerSettings";

const steps = [
  { title: "Pretensões", icon: DollarSign },
  { title: "Custos", icon: Calculator },
  { title: "Hora Técnica", icon: Clock },
  { title: "Valor do Job", icon: Briefcase },
];

const defaultCosts: CostItem[] = [
  { description: "Internet", value: 0 },
  { description: "Energia", value: 0 },
  { description: "Softwares", value: 0 },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Calculadora() {
  const { settings, isLoading, upsert } = useFreelancerSettings();
  const [step, setStep] = useState(0);

  const [salary, setSalary] = useState(5000);
  const [weeklyDays, setWeeklyDays] = useState(5);
  const [dailyHours, setDailyHours] = useState(8);
  const [vacationWeeks, setVacationWeeks] = useState(4);
  const [costs, setCosts] = useState<CostItem[]>(defaultCosts);

  // Job calc
  const [jobHoursPerDay, setJobHoursPerDay] = useState(4);
  const [jobDays, setJobDays] = useState(5);

  useEffect(() => {
    if (settings) {
      setSalary(Number(settings.desired_salary) || 5000);
      setWeeklyDays(Number(settings.weekly_days) || 5);
      setDailyHours(Number(settings.daily_hours) || 8);
      setVacationWeeks(Number(settings.vacation_weeks) || 4);
      const mc = settings.monthly_costs;
      if (Array.isArray(mc) && mc.length > 0) setCosts(mc);
      if (Number(settings.calculated_hour_rate) > 0) {
        // already loaded
      }
    }
  }, [settings]);

  const totalCosts = useMemo(() => costs.reduce((s, c) => s + (c.value || 0), 0), [costs]);

  const hourRate = useMemo(() => {
    if (weeklyDays <= 0 || dailyHours <= 0) return 0;
    const monthlyHours = weeklyDays * dailyHours * 4.33;
    const workedMonths = 12 - vacationWeeks / 4;
    if (workedMonths <= 0) return 0;
    const realHours = monthlyHours * (workedMonths / 12);
    if (realHours <= 0) return 0;
    return (salary + totalCosts) / realHours;
  }, [salary, weeklyDays, dailyHours, vacationWeeks, totalCosts]);

  const jobValue = useMemo(() => hourRate * jobHoursPerDay * jobDays, [hourRate, jobHoursPerDay, jobDays]);

  const addCost = () => setCosts(p => [...p, { description: "", value: 0 }]);
  const removeCost = (i: number) => setCosts(p => p.filter((_, idx) => idx !== i));
  const updateCost = (i: number, field: keyof CostItem, val: string | number) =>
    setCosts(p => p.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));

  const handleSave = () => {
    upsert.mutate({
      desired_salary: salary,
      weekly_days: weeklyDays,
      daily_hours: dailyHours,
      vacation_weeks: vacationWeeks,
      monthly_costs: costs,
      calculated_hour_rate: Math.round(hourRate * 100) / 100,
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calculadora Freelancer</h1>
          <p className="text-muted-foreground text-sm">Descubra quanto cobrar pelo seu trabalho</p>
        </div>
        <Button variant="outline" onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          Salvar
        </Button>
      </div>

      {/* Steps */}
      <div className="flex gap-1">
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${active ? "bg-primary text-primary-foreground shadow-md" : done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
              {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Suas Pretensões</h2>
              <p className="text-sm text-muted-foreground">Defina quanto deseja ganhar e sua rotina de trabalho.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Salário desejado (mensal)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input type="number" min={0} value={salary} onChange={e => setSalary(Number(e.target.value))} className="pl-10" />
                  </div>
                </div>
                <div>
                  <Label>Dias de trabalho por semana</Label>
                  <Input type="number" min={1} max={7} value={weeklyDays} onChange={e => setWeeklyDays(Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label>Horas por dia</Label>
                  <Input type="number" min={1} max={24} value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label>Semanas de férias por ano</Label>
                  <Input type="number" min={0} max={52} value={vacationWeeks} onChange={e => setVacationWeeks(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Custos Mensais</h2>
                  <p className="text-sm text-muted-foreground">Adicione seus custos fixos mensais.</p>
                </div>
                <Button variant="outline" size="sm" onClick={addCost}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
              </div>
              <div className="space-y-2">
                {costs.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Descrição" value={c.description} onChange={e => updateCost(i, "description", e.target.value)} className="flex-1" />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input type="number" min={0} value={c.value} onChange={e => updateCost(i, "value", Number(e.target.value))} className="pl-10" />
                    </div>
                    <button onClick={() => removeCost(i)} className="p-2 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end p-3 bg-muted rounded-lg">
                <span className="text-sm font-semibold">Total de custos: <span className="text-primary">{fmt(totalCosts)}</span></span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 text-center">
              <h2 className="text-lg font-semibold">Sua Hora Técnica</h2>
              <p className="text-sm text-muted-foreground">Calculada automaticamente com base nas etapas anteriores.</p>
              <div className="py-8">
                <p className="text-sm text-muted-foreground mb-2">Sua hora técnica é:</p>
                <p className="text-5xl font-extrabold text-success">{fmt(hourRate)}<span className="text-lg font-normal text-muted-foreground">/h</span></p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Salário</p>
                  <p className="text-sm font-semibold">{fmt(salary)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Custos</p>
                  <p className="text-sm font-semibold">{fmt(totalCosts)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Horas/mês</p>
                  <p className="text-sm font-semibold">{(weeklyDays * dailyHours * 4.33).toFixed(0)}h</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">Férias</p>
                  <p className="text-sm font-semibold">{vacationWeeks} sem.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-center">Valor do Job</h2>
              <p className="text-sm text-muted-foreground text-center">Informe as horas e dias do projeto.</p>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div>
                  <Label>Horas por dia</Label>
                  <Input type="number" min={1} value={jobHoursPerDay} onChange={e => setJobHoursPerDay(Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label>Dias do projeto</Label>
                  <Input type="number" min={1} value={jobDays} onChange={e => setJobDays(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">Valor total do job:</p>
                <p className="text-5xl font-extrabold text-success">{fmt(jobValue)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {fmt(hourRate)}/h × {jobHoursPerDay}h/dia × {jobDays} dias
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>Anterior</Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)}>Próximo</Button>
        ) : (
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Salvar Configurações
          </Button>
        )}
      </div>
    </div>
  );
}
