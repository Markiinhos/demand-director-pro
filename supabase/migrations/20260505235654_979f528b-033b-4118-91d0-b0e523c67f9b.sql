
-- ============ BLOCO 1: SEGURANÇA ============

-- 1. RLS em mp_oauth_states (sem políticas → só service role acessa)
ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY;

-- 2. Endurecer payment_events: remover policies permissivas e recriar restritas
DROP POLICY IF EXISTS "Users can insert own events" ON public.payment_events;
DROP POLICY IF EXISTS "Users can update own events" ON public.payment_events;

CREATE POLICY "Users can insert own events"
  ON public.payment_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON public.payment_events FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_demands_user_status ON public.demands(user_id, status);
CREATE INDEX IF NOT EXISTS idx_demands_user_due ON public.demands(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_user_due ON public.financial_entries(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_user_status ON public.financial_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_charges_user_status ON public.payment_charges(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_clients_user_status ON public.clients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_user_stage ON public.clients(user_id, lead_stage);
CREATE INDEX IF NOT EXISTS idx_budgets_user_status ON public.budgets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON public.budget_items(budget_id);

-- ============ BLOCO 2: LIMITES DE PLANO ============

CREATE OR REPLACE FUNCTION public.enforce_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_count INTEGER;
BEGIN
  -- Busca plano ativo do usuário
  SELECT p.max_clients, p.max_demands_per_month, p.name
    INTO v_plan
  FROM public.user_subscriptions us
  JOIN public.subscription_plans p ON p.id = us.plan_id
  WHERE us.user_id = NEW.user_id
    AND us.status IN ('active', 'trialing')
  LIMIT 1;

  -- Sem assinatura → trata como Free (limites do plano free)
  IF v_plan IS NULL THEN
    SELECT max_clients, max_demands_per_month, name INTO v_plan
    FROM public.subscription_plans WHERE id = 'free';
  END IF;

  IF TG_TABLE_NAME = 'clients' AND v_plan.max_clients IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.clients WHERE user_id = NEW.user_id;
    IF v_count >= v_plan.max_clients THEN
      RAISE EXCEPTION 'PLAN_LIMIT_CLIENTS: O plano % permite no máximo % clientes. Faça upgrade para Pro.',
        v_plan.name, v_plan.max_clients
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'demands' AND v_plan.max_demands_per_month IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.demands
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('month', now());
    IF v_count >= v_plan.max_demands_per_month THEN
      RAISE EXCEPTION 'PLAN_LIMIT_DEMANDS: O plano % permite no máximo % demandas por mês. Faça upgrade para Pro.',
        v_plan.name, v_plan.max_demands_per_month
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_clients ON public.clients;
CREATE TRIGGER trg_enforce_plan_clients
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_demands ON public.demands;
CREATE TRIGGER trg_enforce_plan_demands
  BEFORE INSERT ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();
