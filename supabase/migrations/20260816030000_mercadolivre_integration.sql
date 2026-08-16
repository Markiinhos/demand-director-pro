-- ============================================================
-- Migração: Integração com Mercado Livre (Conexão OAuth, Pedidos e Demandas)
-- ============================================================

-- 1. Tabela de conexões Mercado Livre
CREATE TABLE IF NOT EXISTS mercadolivre_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  nickname TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'disconnected')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mercadolivre_connections_user_id_key UNIQUE (user_id)
);

ALTER TABLE mercadolivre_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mercadolivre_connections_own') THEN
    CREATE POLICY "mercadolivre_connections_own" ON mercadolivre_connections
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tabela de pedidos do Mercado Livre
CREATE TABLE IF NOT EXISTS mercadolivre_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml_order_id TEXT NOT NULL,
  ml_pack_id TEXT,
  status TEXT NOT NULL,
  buyer_id TEXT,
  buyer_name TEXT,
  total_amount NUMERIC(12,2) NOT NULL,
  currency_id TEXT DEFAULT 'BRL',
  order_date TIMESTAMPTZ,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mercadolivre_orders_user_ml_order_key UNIQUE (user_id, ml_order_id)
);

ALTER TABLE mercadolivre_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mercadolivre_orders_own') THEN
    CREATE POLICY "mercadolivre_orders_own" ON mercadolivre_orders
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ml_orders_user_id ON mercadolivre_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_orders_ml_order_id ON mercadolivre_orders(ml_order_id);

-- 3. Adicionar referência de ml_order_id na tabela de demandas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'demands' AND column_name = 'ml_order_id'
  ) THEN
    ALTER TABLE demands ADD COLUMN ml_order_id TEXT;
  END IF;
END $$;
