-- Agency Manager extension migration
-- 1. Compliance Obligations
CREATE TYPE compliance_status AS ENUM ('ok', 'warning', 'critical', 'expired');

CREATE TABLE compliance_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    responsible_name TEXT,
    periodicity TEXT,
    due_date TIMESTAMPTZ,
    status compliance_status DEFAULT 'ok',
    risk_level TEXT,
    official_source TEXT,
    last_verified TIMESTAMPTZ,
    next_revision TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_compliance_user_id ON compliance_obligations(user_id);
CREATE INDEX idx_compliance_client_id ON compliance_obligations(client_id);

-- 2. Meetings
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    agenda TEXT,
    notes TEXT,
    summary TEXT,
    decisions TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_client_id ON meetings(client_id);

-- 3. Update ai_routines for robust execution
ALTER TABLE ai_routines ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE ai_routines ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE ai_routines ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE ai_routines ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;

-- RLS
ALTER TABLE compliance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT unnest(ARRAY['compliance_obligations', 'meetings'])
    LOOP
        EXECUTE format('
            CREATE POLICY "%1$s_select" ON %1$s FOR SELECT USING (auth.uid() = user_id);
            CREATE POLICY "%1$s_insert" ON %1$s FOR INSERT WITH CHECK (auth.uid() = user_id);
            CREATE POLICY "%1$s_update" ON %1$s FOR UPDATE USING (auth.uid() = user_id);
            CREATE POLICY "%1$s_delete" ON %1$s FOR DELETE USING (auth.uid() = user_id);
        ', t_name);
    END LOOP;
END;
$$;

-- Triggers for multi-tenancy & timestamps
CREATE OR REPLACE FUNCTION check_agency_manager_ownership()
RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'compliance_obligations' AND NEW.client_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'client_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'meetings' AND NEW.client_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'client_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'ai_routines' AND NEW.client_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'client_id não pertence ao mesmo user_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_ownership_compliance BEFORE INSERT OR UPDATE ON compliance_obligations FOR EACH ROW EXECUTE FUNCTION check_agency_manager_ownership();
CREATE TRIGGER tr_check_ownership_meetings BEFORE INSERT OR UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION check_agency_manager_ownership();
CREATE TRIGGER tr_check_ownership_ai_routines_client BEFORE INSERT OR UPDATE ON ai_routines FOR EACH ROW EXECUTE FUNCTION check_agency_manager_ownership();

CREATE TRIGGER update_compliance_updated_at BEFORE UPDATE ON compliance_obligations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
