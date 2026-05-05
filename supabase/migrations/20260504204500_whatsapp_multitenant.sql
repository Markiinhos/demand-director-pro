-- =============================================
-- WHATSAPP MULTI-TENANT: whatsapp_connections
-- =============================================

CREATE TABLE public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp',
  business_account_id TEXT,
  phone_number_id TEXT NOT NULL,
  phone_number TEXT,
  display_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_connections"
  ON public.whatsapp_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp_connections"
  ON public.whatsapp_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whatsapp_connections"
  ON public.whatsapp_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whatsapp_connections"
  ON public.whatsapp_connections FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_connections_user_id ON public.whatsapp_connections(user_id);
CREATE INDEX idx_whatsapp_connections_phone_number_id ON public.whatsapp_connections(phone_number_id);
CREATE UNIQUE INDEX idx_whatsapp_connections_user_phone ON public.whatsapp_connections(user_id, phone_number_id);

CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- EVOLVE: whatsapp_messages (add connection ref + media + expanded types)
-- =============================================

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS whatsapp_connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Drop and recreate check constraint to allow more message types
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type IN ('text', 'template', 'document', 'image', 'audio', 'video', 'interactive', 'payment', 'contract', 'budget', 'system'));

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_connection_id ON public.whatsapp_messages(whatsapp_connection_id);

-- Allow service role to insert inbound messages (webhook)
CREATE POLICY "Service role can insert whatsapp_messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (true);

-- Allow service role to update message status (webhook)
CREATE POLICY "Service role can update whatsapp_messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (true);

-- =============================================
-- EVOLVE: whatsapp_templates (add connection ref)
-- =============================================

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS whatsapp_connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

-- =============================================
-- EVOLVE: whatsapp_logs (allow null user_id for webhook logs)
-- =============================================

-- Service role needs to insert logs
CREATE POLICY "Service role can insert whatsapp_logs"
  ON public.whatsapp_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- REALTIME for whatsapp_messages
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
