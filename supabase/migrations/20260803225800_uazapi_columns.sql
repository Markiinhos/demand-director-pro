-- Adicionar suporte UAZAPI no whatsapp_connections
ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'meta';
ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS instance_name TEXT;
ALTER TABLE whatsapp_connections ADD COLUMN IF NOT EXISTS api_url TEXT;

-- Adicionar canal whatsapp aos budgets que faltava
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT false;
