
-- Enum for budget status
CREATE TYPE public.budget_status AS ENUM ('rascunho', 'enviado', 'aprovado', 'recusado');

-- Budgets table
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  notes text,
  status budget_status NOT NULL DEFAULT 'rascunho',
  valid_until date,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_client_id ON public.budgets(client_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Budget items table
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget_items" ON public.budget_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budget_items" ON public.budget_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget_items" ON public.budget_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget_items" ON public.budget_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_budget_items_budget_id ON public.budget_items(budget_id);

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  message_type text NOT NULL CHECK (message_type IN ('text', 'template', 'interactive', 'system')),
  template_name text,
  wa_message_id text,
  conversation_id text,
  content text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whatsapp_messages" ON public.whatsapp_messages FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_client_id ON public.whatsapp_messages(client_id);
CREATE INDEX idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);

CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- WhatsApp templates table
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  language_code text NOT NULL DEFAULT 'pt_BR',
  template_key text NOT NULL,
  status text,
  variables_schema jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_templates" ON public.whatsapp_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp_templates" ON public.whatsapp_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whatsapp_templates" ON public.whatsapp_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whatsapp_templates" ON public.whatsapp_templates FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_templates_user_id ON public.whatsapp_templates(user_id);

CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- WhatsApp logs table
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_logs" ON public.whatsapp_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp_logs" ON public.whatsapp_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_logs_user_id ON public.whatsapp_logs(user_id);
CREATE INDEX idx_whatsapp_logs_event_type ON public.whatsapp_logs(event_type);
