
-- Realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Planos
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month',
  max_clients INTEGER,
  max_demands_per_month INTEGER,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  mp_preapproval_plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);

INSERT INTO public.subscription_plans (id, name, description, price_brl, max_clients, max_demands_per_month, features, sort_order)
VALUES
  ('free', 'Free', 'Para começar e testar a plataforma', 0, 3, 10, '["Até 3 clientes","Até 10 demandas/mês","Portal do cliente","1 modelo de contrato"]'::jsonb, 1),
  ('pro', 'Pro', 'Para designers e pequenas agências em crescimento', 49.90, NULL, NULL, '["Clientes ilimitados","Demandas ilimitadas","Portal do cliente","Contratos ilimitados","Briefings ilimitados","Cobrança Mercado Pago","WhatsApp Business","Suporte prioritário"]'::jsonb, 2);

-- Assinaturas
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','paused');

CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  mp_preapproval_id TEXT,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscription" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscription" ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_subscriptions_updated
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-criar plano free para novos usuários
CREATE OR REPLACE FUNCTION public.assign_default_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_default_plan
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_default_plan();

-- Backfill para usuários existentes
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
SELECT id, 'free', 'active' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Onboarding
CREATE TABLE public.user_onboarding (
  user_id UUID PRIMARY KEY,
  completed BOOLEAN NOT NULL DEFAULT false,
  current_step INTEGER NOT NULL DEFAULT 0,
  steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own onboarding" ON public.user_onboarding FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own onboarding" ON public.user_onboarding FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own onboarding" ON public.user_onboarding FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_onboarding_updated
BEFORE UPDATE ON public.user_onboarding
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
