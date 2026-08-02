-- GPT Integrations
CREATE TABLE chatgpt_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chatgpt_integrations_key_hash ON chatgpt_integrations(key_hash);
CREATE INDEX idx_chatgpt_integrations_user_id ON chatgpt_integrations(user_id);

ALTER TABLE chatgpt_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatgpt_integrations_select" ON chatgpt_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chatgpt_integrations_insert" ON chatgpt_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chatgpt_integrations_update" ON chatgpt_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "chatgpt_integrations_delete" ON chatgpt_integrations FOR DELETE USING (auth.uid() = user_id);

-- Contracts update
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'sent_at') THEN
        ALTER TABLE contracts ADD COLUMN sent_at TIMESTAMPTZ;
        ALTER TABLE contracts ADD COLUMN viewed_at TIMESTAMPTZ;
        ALTER TABLE contracts ADD COLUMN expires_at TIMESTAMPTZ;
        ALTER TABLE contracts ADD COLUMN renewal_date TIMESTAMPTZ;
        ALTER TABLE contracts ADD COLUMN version TEXT DEFAULT '1.0';
        ALTER TABLE contracts ADD COLUMN partner_id TEXT;
        ALTER TABLE contracts ADD COLUMN signature_provider TEXT;
        ALTER TABLE contracts ADD COLUMN external_signature_id TEXT;
    END IF;
END $$;

-- Idempotency key logic
ALTER TABLE ai_actions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ai_actions_idempotency_idx ON ai_actions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
