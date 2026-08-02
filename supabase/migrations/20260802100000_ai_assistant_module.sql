-- Supabase Migration: AI Assistant Module with Strong Multi-tenant Security
-- Create ENUMs for strict type checking
CREATE TYPE ai_risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE ai_action_status AS ENUM ('pending', 'pending_approval', 'executed', 'rejected', 'failed');
CREATE TYPE ai_role AS ENUM ('user', 'assistant', 'system', 'tool');

-- 1. ai_agents
CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT,
    model TEXT DEFAULT 'gpt-4o',
    temperature NUMERIC DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2.0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_agents_user_id ON ai_agents(user_id);

-- 2. ai_conversations
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    title TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_status ON ai_conversations(status);

-- 3. ai_messages
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role ai_role NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);

-- 4. ai_actions
CREATE TABLE ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    arguments JSONB,
    result JSONB,
    status ai_action_status DEFAULT 'pending',
    risk_level ai_risk_level DEFAULT 'low',
    requires_approval BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_actions_user_id ON ai_actions(user_id);
CREATE INDEX idx_ai_actions_status ON ai_actions(status);

-- 5. ai_knowledge
CREATE TABLE ai_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE, 
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_knowledge_user_id ON ai_knowledge(user_id);
CREATE INDEX idx_ai_knowledge_client_id ON ai_knowledge(client_id);

-- 6. ai_routines
CREATE TABLE ai_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    routine_type TEXT NOT NULL,
    configuration JSONB DEFAULT '{}',
    schedule TEXT,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ai_events
CREATE TABLE ai_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. ai_usage_logs (New)
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);

-- MULTI-TENANT SECURITY TRIGGERS
-- Ensure that children records ALWAYS point to parents that belong to the SAME user_id.

CREATE OR REPLACE FUNCTION check_ai_ownership()
RETURNS trigger AS $$
BEGIN
    -- ai_conversations -> ai_agents
    IF TG_TABLE_NAME = 'ai_conversations' AND NEW.agent_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM ai_agents WHERE id = NEW.agent_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'agent_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    -- ai_messages -> ai_conversations
    IF TG_TABLE_NAME = 'ai_messages' THEN
        IF NOT EXISTS (SELECT 1 FROM ai_conversations WHERE id = NEW.conversation_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'conversation_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    -- ai_actions -> ai_conversations
    IF TG_TABLE_NAME = 'ai_actions' AND NEW.conversation_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM ai_conversations WHERE id = NEW.conversation_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'conversation_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    -- ai_knowledge -> clients
    IF TG_TABLE_NAME = 'ai_knowledge' AND NEW.client_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'client_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_ownership_conversations BEFORE INSERT OR UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION check_ai_ownership();
CREATE TRIGGER tr_check_ownership_messages BEFORE INSERT OR UPDATE ON ai_messages FOR EACH ROW EXECUTE FUNCTION check_ai_ownership();
CREATE TRIGGER tr_check_ownership_actions BEFORE INSERT OR UPDATE ON ai_actions FOR EACH ROW EXECUTE FUNCTION check_ai_ownership();
CREATE TRIGGER tr_check_ownership_knowledge BEFORE INSERT OR UPDATE ON ai_knowledge FOR EACH ROW EXECUTE FUNCTION check_ai_ownership();

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ai_knowledge_updated_at BEFORE UPDATE ON ai_knowledge FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ai_routines_updated_at BEFORE UPDATE ON ai_routines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Habilitando RLS em todas as tabelas
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS seguras (auth.uid() = user_id)
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT unnest(ARRAY['ai_agents', 'ai_conversations', 'ai_messages', 'ai_actions', 'ai_knowledge', 'ai_routines', 'ai_events', 'ai_usage_logs'])
    LOOP
        EXECUTE format('
            CREATE POLICY "%1$s_select_policy" ON %1$s FOR SELECT USING (auth.uid() = user_id);
            CREATE POLICY "%1$s_insert_policy" ON %1$s FOR INSERT WITH CHECK (auth.uid() = user_id);
            CREATE POLICY "%1$s_update_policy" ON %1$s FOR UPDATE USING (auth.uid() = user_id);
            CREATE POLICY "%1$s_delete_policy" ON %1$s FOR DELETE USING (auth.uid() = user_id);
        ', t_name);
    END LOOP;
END;
$$;
