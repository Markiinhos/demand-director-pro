
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp',
  phone_number TEXT,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT,
  display_name TEXT,
  access_token_encrypted TEXT,
  webhook_verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number_id)
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own whatsapp_connections" ON public.whatsapp_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own whatsapp_connections" ON public.whatsapp_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own whatsapp_connections" ON public.whatsapp_connections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own whatsapp_connections" ON public.whatsapp_connections
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_whatsapp_connections_updated
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS whatsapp_connection_id UUID;
