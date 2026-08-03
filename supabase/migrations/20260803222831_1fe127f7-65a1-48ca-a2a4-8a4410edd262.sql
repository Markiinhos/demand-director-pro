-- =========================================================
-- 1. chatgpt_integrations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chatgpt_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatgpt_integrations TO authenticated;
GRANT ALL ON public.chatgpt_integrations TO service_role;
ALTER TABLE public.chatgpt_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own chatgpt integrations" ON public.chatgpt_integrations;
CREATE POLICY "own chatgpt integrations" ON public.chatgpt_integrations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_chatgpt_integrations_updated ON public.chatgpt_integrations;
CREATE TRIGGER trg_chatgpt_integrations_updated BEFORE UPDATE ON public.chatgpt_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_chatgpt_integrations_user ON public.chatgpt_integrations(user_id);

-- =========================================================
-- 2. meetings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  agenda TEXT,
  notes TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own meetings" ON public.meetings;
CREATE POLICY "own meetings" ON public.meetings
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_meetings_updated ON public.meetings;
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meetings_user_date ON public.meetings(user_id, scheduled_at);

-- =========================================================
-- 3. whatsapp_authorized_numbers
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_authorized_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  access_role TEXT NOT NULL DEFAULT 'unknown',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_authorized_numbers TO authenticated;
GRANT ALL ON public.whatsapp_authorized_numbers TO service_role;
ALTER TABLE public.whatsapp_authorized_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own wa authorized numbers" ON public.whatsapp_authorized_numbers;
CREATE POLICY "own wa authorized numbers" ON public.whatsapp_authorized_numbers
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_wa_numbers_updated ON public.whatsapp_authorized_numbers;
CREATE TRIGGER trg_wa_numbers_updated BEFORE UPDATE ON public.whatsapp_authorized_numbers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- 4. whatsapp_conversations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  conversation_type TEXT NOT NULL DEFAULT 'admin',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ai_conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own wa conversations" ON public.whatsapp_conversations;
CREATE POLICY "own wa conversations" ON public.whatsapp_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_wa_conversations_updated ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_conversations_updated BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- 5. ai_actions: canal, contexto externo, confirmação
-- =========================================================
ALTER TABLE public.ai_actions
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'internal_chat',
  ADD COLUMN IF NOT EXISTS external_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS external_user_identifier TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_actions_idempotency
  ON public.ai_actions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_actions_user_status ON public.ai_actions(user_id, status);

-- =========================================================
-- 6. ai_events: auditoria completa
-- =========================================================
ALTER TABLE public.ai_events
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS tool_name TEXT,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS action_id UUID,
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS external_identifier TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_events_user_created ON public.ai_events(user_id, created_at DESC);

-- =========================================================
-- 7. Memória multicanal em conversas e mensagens
-- =========================================================
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'internal_chat',
  ADD COLUMN IF NOT EXISTS external_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS external_user_identifier TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'internal_chat';

-- =========================================================
-- 8. whatsapp_messages: conversa, provedor, idempotência
-- =========================================================
ALTER TABLE public.whatsapp_messages
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_provider_message
  ON public.whatsapp_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;