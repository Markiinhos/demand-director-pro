-- ============================================================
-- Migração: Cadastro Completo do Cliente (PF/PJ)
-- Adiciona campos de documentos, endereço, e referências externas
-- ============================================================

-- 1. Criar enum para tipo de pessoa
DO $$ BEGIN
  CREATE TYPE person_type AS ENUM ('fisica', 'juridica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar campos de pessoa/documentos
ALTER TABLE clients ADD COLUMN IF NOT EXISTS person_type person_type;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state_registration TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS municipal_registration TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 3. Adicionar campos de endereço
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS complement TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Brasil';

-- 4. Campos de integração (Asaas + Mercado Livre)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS asaas_sync_status TEXT DEFAULT 'not_synced';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS asaas_synced_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mercado_livre_buyer_id TEXT;

-- 5. Índices para busca rápida (sem expor dados)
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients(user_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON clients(user_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_person_type ON clients(user_id, person_type) WHERE person_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_asaas_customer ON clients(user_id, asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_ml_buyer ON clients(user_id, mercado_livre_buyer_id) WHERE mercado_livre_buyer_id IS NOT NULL;

-- 6. Função trigger para updated_at
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger apenas se não existir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_updated_at'
  ) THEN
    CREATE TRIGGER trg_clients_updated_at
      BEFORE UPDATE ON clients
      FOR EACH ROW
      EXECUTE FUNCTION update_clients_updated_at();
  END IF;
END $$;
