import { Check, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlans, useMySubscription } from "@/hooks/useSubscription";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function Planos() {
  const { data: plans, isLoading } = usePlans();
  const { subscription, subscribe } = useMySubscription();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("status") === "success") {
      toast({ title: "Assinatura confirmada!", description: "Seu plano será ativado em instantes." });
      params.delete("status");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const handleSubscribe = async (planId: string) => {
    try {
      const result = await subscribe.mutateAsync(planId);
      if (result.free) {
        toast({ title: "Plano Free ativado" });
      } else if (result.init_point) {
        window.location.href = result.init_point;
      }
    } catch (e: any) {
      toast({ title: "Erro ao iniciar assinatura", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Escolha seu plano</h1>
        <p className="text-muted-foreground">
          Comece de graça, evolua quando quiser. Cancele a qualquer momento.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {plans?.map((plan) => {
          const isCurrent = subscription?.plan_id === plan.id;
          const isPro = plan.id === "pro";
          return (
            <Card key={plan.id} className={isPro ? "border-primary shadow-lg relative" : ""}>
              {isPro && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Crown className="h-3 w-3 mr-1" /> Mais popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isCurrent && <Badge variant="secondary">Plano atual</Badge>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-4xl font-bold">
                    R$ {Number(plan.price_brl).toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features?.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isPro ? "default" : "outline"}
                  disabled={isCurrent || subscribe.isPending}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {subscribe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isCurrent ? "Plano atual" : isPro ? "Assinar Pro" : "Usar Free"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}