
-- Enums
CREATE TYPE public.client_type AS ENUM ('cliente', 'lead', 'terceirizado', 'parceiro');
CREATE TYPE public.lead_stage AS ENUM ('novo_lead', 'contato_inicial', 'briefing', 'proposta_enviada', 'negociacao', 'aprovado', 'perdido', 'inativo');
CREATE TYPE public.interaction_type AS ENUM ('ligacao', 'whatsapp', 'reuniao', 'proposta', 'followup', 'fechamento', 'sem_retorno');
CREATE TYPE public.close_potential AS ENUM ('baixo', 'medio', 'alto');

-- Add columns to clients
ALTER TABLE public.clients
  ADD COLUMN type public.client_type NOT NULL DEFAULT 'cliente',
  ADD COLUMN lead_stage public.lead_stage NULL,
  ADD COLUMN lead_source text NULL,
  ADD COLUMN segment text NULL,
  ADD COLUMN city text NULL,
  ADD COLUMN state text NULL,
  ADD COLUMN instagram text NULL,
  ADD COLUMN specialty text NULL,
  ADD COLUMN service_provided text NULL,
  ADD COLUMN first_contact_at date NULL,
  ADD COLUMN last_interaction_at timestamptz NULL,
  ADD COLUMN next_action text NULL,
  ADD COLUMN next_action_date date NULL,
  ADD COLUMN sales_notes text NULL,
  ADD COLUMN close_potential public.close_potential NULL;

-- Create client_interactions table
CREATE TABLE public.client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_type public.interaction_type NOT NULL,
  description text NULL,
  interaction_date timestamptz NOT NULL DEFAULT now(),
  next_step text NULL,
  next_step_date date NULL,
  responsible text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own interactions" ON public.client_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interactions" ON public.client_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interactions" ON public.client_interactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interactions" ON public.client_interactions FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_client_interactions_updated_at
  BEFORE UPDATE ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_client_interactions_user_id ON public.client_interactions(user_id);
CREATE INDEX idx_client_interactions_client_id ON public.client_interactions(client_id);
CREATE INDEX idx_clients_type ON public.clients(type);
CREATE INDEX idx_clients_lead_stage ON public.clients(lead_stage);
CREATE INDEX idx_clients_next_action_date ON public.clients(next_action_date);
