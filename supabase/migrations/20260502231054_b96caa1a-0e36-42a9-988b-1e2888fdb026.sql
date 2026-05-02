
-- =========================================================
-- Sprint 1: Portal do Cliente, Aprovações, Briefing, Proposta, Contratos
-- =========================================================

-- 1) PORTAL TOKENS (link mágico por cliente) ---------------
CREATE TABLE public.client_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_tokens_client ON public.client_portal_tokens(client_id);
CREATE INDEX idx_portal_tokens_token ON public.client_portal_tokens(token);
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own portal tokens" ON public.client_portal_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own portal tokens" ON public.client_portal_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own portal tokens" ON public.client_portal_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own portal tokens" ON public.client_portal_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_portal_tokens_updated_at
  BEFORE UPDATE ON public.client_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) DEMAND VERSIONS (V1, V2, V3...) -----------------------
CREATE TABLE public.demand_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  demand_id UUID NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (demand_id, version_number)
);
CREATE INDEX idx_demand_versions_demand ON public.demand_versions(demand_id);
ALTER TABLE public.demand_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own demand_versions" ON public.demand_versions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own demand_versions" ON public.demand_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own demand_versions" ON public.demand_versions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own demand_versions" ON public.demand_versions
  FOR DELETE USING (auth.uid() = user_id);

-- 3) DEMAND FEEDBACK (aprova / pede ajuste) ----------------
DO $$ BEGIN
  CREATE TYPE public.demand_feedback_action AS ENUM ('approved', 'changes_requested', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.demand_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  demand_id UUID NOT NULL,
  version_id UUID,
  action public.demand_feedback_action NOT NULL,
  comment TEXT,
  author_name TEXT,
  source TEXT NOT NULL DEFAULT 'portal', -- portal | internal
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demand_feedback_demand ON public.demand_feedback(demand_id);
ALTER TABLE public.demand_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own demand_feedback" ON public.demand_feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own demand_feedback" ON public.demand_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own demand_feedback" ON public.demand_feedback
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own demand_feedback" ON public.demand_feedback
  FOR DELETE USING (auth.uid() = user_id);

-- 4) BRIEFINGS (formulário por link) -----------------------
DO $$ BEGIN
  CREATE TYPE public.briefing_status AS ENUM ('draft', 'sent', 'answered', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  demand_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  token TEXT NOT NULL UNIQUE,
  schema JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id,label,type,required,options?}]
  status public.briefing_status NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefings_token ON public.briefings(token);
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own briefings" ON public.briefings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own briefings" ON public.briefings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own briefings" ON public.briefings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own briefings" ON public.briefings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_briefings_updated_at
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5) BRIEFING RESPONSES ------------------------------------
CREATE TABLE public.briefing_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  briefing_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  respondent_name TEXT,
  respondent_email TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefing_responses_briefing ON public.briefing_responses(briefing_id);
ALTER TABLE public.briefing_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own briefing_responses" ON public.briefing_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own briefing_responses" ON public.briefing_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own briefing_responses" ON public.briefing_responses
  FOR DELETE USING (auth.uid() = user_id);

-- 6) CONTRACT TEMPLATES (.docx/.txt com placeholders) ------
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'docx', -- docx | txt
  placeholders JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["nome","cpf","valor","servico","data"]
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contract_templates" ON public.contract_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own contract_templates" ON public.contract_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own contract_templates" ON public.contract_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own contract_templates" ON public.contract_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7) CONTRACTS (gerados a partir de template) --------------
DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('draft', 'sent', 'signed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  template_id UUID,
  budget_id UUID,
  title TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_pdf_url TEXT,
  status public.contract_status NOT NULL DEFAULT 'draft',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contracts" ON public.contracts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own contracts" ON public.contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own contracts" ON public.contracts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own contracts" ON public.contracts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8) BUDGETS: link público de proposta + aceite ------------
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_charge_id UUID;

-- Adicionar 'aceito' ao enum budget_status se ainda não existir
DO $$ BEGIN
  ALTER TYPE public.budget_status ADD VALUE IF NOT EXISTS 'aceito';
EXCEPTION WHEN others THEN NULL; END $$;
