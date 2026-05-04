
CREATE TYPE public.notification_type AS ENUM ('info', 'success', 'warning', 'error');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type notification_type NOT NULL DEFAULT 'info',
  link TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Permitir que a edge function public-portal (service role) crie notificações para o dono da conta
-- (já passa via service role, então não precisa de policy extra)

-- Trigger: criar notificação quando arte recebe feedback público
CREATE OR REPLACE FUNCTION public.notify_demand_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demand_title TEXT;
BEGIN
  SELECT title INTO demand_title FROM public.demands WHERE id = NEW.demand_id;
  INSERT INTO public.notifications (user_id, title, message, type, link, related_entity_type, related_entity_id)
  VALUES (
    NEW.user_id,
    CASE NEW.action
      WHEN 'approved' THEN 'Arte aprovada pelo cliente ✓'
      WHEN 'rejected' THEN 'Arte com pedido de ajuste'
      ELSE 'Novo feedback do cliente'
    END,
    COALESCE(demand_title, 'Demanda') || COALESCE(' — ' || NEW.comment, ''),
    CASE NEW.action WHEN 'approved' THEN 'success'::notification_type WHEN 'rejected' THEN 'warning'::notification_type ELSE 'info'::notification_type END,
    '/demandas',
    'demand',
    NEW.demand_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_demand_feedback
AFTER INSERT ON public.demand_feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_feedback();

-- Trigger: notificação quando proposta pública é aceita
CREATE OR REPLACE FUNCTION public.notify_budget_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL AND (OLD.accepted_at IS NULL OR OLD.accepted_at IS DISTINCT FROM NEW.accepted_at) THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, related_entity_type, related_entity_id)
    VALUES (
      NEW.user_id,
      'Orçamento aceito 🎉',
      NEW.title || COALESCE(' — por ' || NEW.accepted_by_name, ''),
      'success'::notification_type,
      '/orcamentos',
      'budget',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_budget_accepted
AFTER UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.notify_budget_accepted();

-- Trigger: notificação quando pagamento é confirmado
CREATE OR REPLACE FUNCTION public.notify_payment_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, related_entity_type, related_entity_id)
    VALUES (
      NEW.user_id,
      'Pagamento recebido 💰',
      COALESCE(NEW.description, 'Cobrança') || ' — R$ ' || to_char(NEW.amount, 'FM999G999G990D00'),
      'success'::notification_type,
      '/cobrancas',
      'payment_charge',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payment_paid
AFTER UPDATE ON public.payment_charges
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_paid();
