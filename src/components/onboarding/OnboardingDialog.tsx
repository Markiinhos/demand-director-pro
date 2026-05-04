import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useNavigate } from "react-router-dom";
import { Users, FileText, FileSignature, CreditCard, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

const STEPS = [
  {
    icon: Users,
    title: "Cadastre seu primeiro cliente",
    description: "Comece adicionando os clientes que você atende. Você pode salvar contato, segmento e logo.",
    cta: "Ir para Clientes",
    href: "/clientes",
  },
  {
    icon: FileText,
    title: "Crie uma demanda",
    description: "Organize seus jobs no Kanban: pendente, em andamento, revisão e finalizado.",
    cta: "Ir para Demandas",
    href: "/demandas",
  },
  {
    icon: FileSignature,
    title: "Envie um orçamento profissional",
    description: "Monte propostas com itens dinâmicos, exporte em PDF e gere link público para o cliente aceitar.",
    cta: "Ir para Orçamentos",
    href: "/orcamentos",
  },
  {
    icon: CreditCard,
    title: "Receba pagamentos por Pix ou cartão",
    description: "Conecte sua conta Mercado Pago e cobre clientes em segundos.",
    cta: "Ir para Cobranças",
    href: "/cobrancas",
  },
];

export function OnboardingDialog() {
  const { state, isLoading, setStep, complete, dismiss } = useOnboarding();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  if (isLoading) return null;
  if (state?.completed || state?.dismissed_at) return null;

  const currentStep = state?.current_step ?? 0;
  const step = STEPS[Math.min(currentStep, STEPS.length - 1)];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLast = currentStep >= STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      complete();
      setOpen(false);
    } else {
      setStep(currentStep + 1);
    }
  };

  const handleAction = () => {
    navigate(step.href);
    if (!isLast) setStep(currentStep + 1);
    else complete();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{step.title}</DialogTitle>
          <DialogDescription className="text-center">{step.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-center text-muted-foreground">
            Passo {currentStep + 1} de {STEPS.length}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleAction} className="w-full">
            {step.cta} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => dismiss()}>
              Pular tour
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleNext}>
              {isLast ? <><Check className="h-4 w-4 mr-1" /> Concluir</> : "Próximo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}