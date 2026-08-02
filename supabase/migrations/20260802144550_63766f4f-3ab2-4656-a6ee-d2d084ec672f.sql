-- AI AGENTS
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Assistente',
  system_prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_own" ON public.ai_agents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI KNOWLEDGE
CREATE TABLE public.ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge TO authenticated;
GRANT ALL ON public.ai_knowledge TO service_role;
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_knowledge_own" ON public.ai_knowledge FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI CONVERSATIONS
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conversations_own" ON public.ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI MESSAGES
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages_own" ON public.ai_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages (conversation_id, created_at);

-- AI ACTIONS
CREATE TABLE public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  risk_level text NOT NULL DEFAULT 'medium',
  requires_approval boolean NOT NULL DEFAULT true,
  idempotency_key text UNIQUE,
  result jsonb,
  error_message text,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_actions TO authenticated;
GRANT ALL ON public.ai_actions TO service_role;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_actions_own" ON public.ai_actions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ai_actions_user_status_idx ON public.ai_actions (user_id, status, created_at DESC);

-- AI EVENTS
CREATE TABLE public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processed',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_events TO authenticated;
GRANT ALL ON public.ai_events TO service_role;
ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_events_select_own" ON public.ai_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- AI ROUTINES
CREATE TABLE public.ai_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  routine_type text NOT NULL,
  schedule text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_routines TO authenticated;
GRANT ALL ON public.ai_routines TO service_role;
ALTER TABLE public.ai_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_routines_own" ON public.ai_routines FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- COMPLIANCE OBLIGATIONS
CREATE TABLE public.compliance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_obligations TO authenticated;
GRANT ALL ON public.compliance_obligations TO service_role;
ALTER TABLE public.compliance_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_obligations_own" ON public.compliance_obligations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER ai_knowledge_updated_at BEFORE UPDATE ON public.ai_knowledge FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER ai_actions_updated_at BEFORE UPDATE ON public.ai_actions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER ai_routines_updated_at BEFORE UPDATE ON public.ai_routines FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER compliance_obligations_updated_at BEFORE UPDATE ON public.compliance_obligations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();