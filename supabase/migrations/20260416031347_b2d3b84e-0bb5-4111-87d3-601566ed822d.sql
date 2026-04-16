
-- payment_charges table
CREATE TABLE public.payment_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  budget_id uuid NULL,
  demand_id uuid NULL,
  financial_entry_id uuid NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_charge_id text NULL,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  description text NULL,
  due_date date NULL,
  payment_link text NULL,
  invoice_url text NULL,
  bank_slip_url text NULL,
  pix_qr_code text NULL,
  pix_copy_paste text NULL,
  card_last4 text NULL,
  paid_at timestamptz NULL,
  external_reference text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own charges" ON public.payment_charges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own charges" ON public.payment_charges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own charges" ON public.payment_charges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own charges" ON public.payment_charges FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_payment_charges_user_id ON public.payment_charges(user_id);
CREATE INDEX idx_payment_charges_client_id ON public.payment_charges(client_id);
CREATE INDEX idx_payment_charges_provider_charge_id ON public.payment_charges(provider_charge_id);
CREATE INDEX idx_payment_charges_status ON public.payment_charges(status);
CREATE INDEX idx_payment_charges_payment_method ON public.payment_charges(payment_method);
CREATE INDEX idx_payment_charges_created_at ON public.payment_charges(created_at);
CREATE INDEX idx_payment_charges_external_reference ON public.payment_charges(external_reference);

CREATE TRIGGER update_payment_charges_updated_at BEFORE UPDATE ON public.payment_charges FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- payment_events table
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  charge_id uuid NULL REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.payment_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.payment_events FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own events" ON public.payment_events FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX idx_payment_events_charge_id ON public.payment_events(charge_id);
CREATE INDEX idx_payment_events_provider ON public.payment_events(provider);
CREATE INDEX idx_payment_events_created_at ON public.payment_events(created_at);

-- Allow service role to insert/update events from webhook (no user context)
CREATE POLICY "Service role can manage events" ON public.payment_events FOR ALL USING (true) WITH CHECK (true);
