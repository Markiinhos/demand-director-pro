-- ============================================================
-- Migração: Integração com Asaas (Conexões, Cobranças e Webhooks)
-- ============================================================

-- 1. Tabela de conexões Asaas
CREATE TABLE IF NOT EXISTS asaas_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT asaas_connections_user_id_key UNIQUE (user_id)
);

ALTER TABLE asaas_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asaas_connections_own') THEN
    CREATE POLICY "asaas_connections_own" ON asaas_connections
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tabela de cobranças Asaas
CREATE TABLE IF NOT EXISTS asaas_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  demand_id UUID REFERENCES demands(id) ON DELETE SET NULL,
  financial_entry_id UUID REFERENCES financial_entries(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  billing_type TEXT NOT NULL CHECK (billing_type IN ('PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED')),
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  description TEXT,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_payload TEXT,
  pix_qr_code TEXT,
  paid_at TIMESTAMPTZ,
  external_reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE asaas_charges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asaas_charges_own') THEN
    CREATE POLICY "asaas_charges_own" ON asaas_charges
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asaas_charges_user_id ON asaas_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_asaas_charges_client_id ON asaas_charges(client_id);
CREATE INDEX IF NOT EXISTS idx_asaas_charges_asaas_payment_id ON asaas_charges(asaas_payment_id);

-- 3. Tabela de auditoria / idempotência de Webhooks Asaas
CREATE TABLE IF NOT EXISTS asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT asaas_webhook_events_unique UNIQUE(user_id, payment_id, event_type)
);

ALTER TABLE asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asaas_webhook_events_own') THEN
    CREATE POLICY "asaas_webhook_events_own" ON asaas_webhook_events
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
