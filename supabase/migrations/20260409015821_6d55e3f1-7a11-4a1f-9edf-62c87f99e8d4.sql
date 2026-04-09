
-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE public.profile_role AS ENUM ('admin', 'designer', 'financeiro');
CREATE TYPE public.client_status AS ENUM ('lead', 'ativo', 'inativo');
CREATE TYPE public.demand_status AS ENUM ('pendente', 'em_andamento', 'revisao', 'finalizado');
CREATE TYPE public.demand_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.demand_type AS ENUM ('post', 'logo', 'banner', 'personalizado', 'outro');
CREATE TYPE public.financial_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.financial_status AS ENUM ('pendente', 'pago', 'atrasado');
CREATE TYPE public.project_status AS ENUM ('briefing', 'criacao', 'revisao', 'entrega', 'concluido');
CREATE TYPE public.task_status AS ENUM ('pendente', 'fazendo', 'concluida');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE public.feedback_status AS ENUM ('enviado', 'aprovado', 'solicitar_ajuste');

-- =============================================
-- FUNÇÃO: updated_at automático
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- TABELA: profiles (1:1 com auth.users)
-- =============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role profile_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: criar profile automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TABELA: clients
-- =============================================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  status client_status NOT NULL DEFAULT 'lead',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TABELA: demands
-- =============================================

CREATE TABLE public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type demand_type NOT NULL DEFAULT 'outro',
  status demand_status NOT NULL DEFAULT 'pendente',
  priority demand_priority NOT NULL DEFAULT 'media',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own demands" ON public.demands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own demands" ON public.demands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own demands" ON public.demands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own demands" ON public.demands FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_demands_user_id ON public.demands(user_id);
CREATE INDEX idx_demands_client_id ON public.demands(client_id);
CREATE INDEX idx_demands_status ON public.demands(status);
CREATE INDEX idx_demands_priority ON public.demands(priority);
CREATE INDEX idx_demands_due_date ON public.demands(due_date);

CREATE TRIGGER update_demands_updated_at BEFORE UPDATE ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TABELA: financial_entries
-- =============================================

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  demand_id UUID REFERENCES public.demands(id) ON DELETE SET NULL,
  type financial_type NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status financial_status NOT NULL DEFAULT 'pendente',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial_entries" ON public.financial_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own financial_entries" ON public.financial_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own financial_entries" ON public.financial_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own financial_entries" ON public.financial_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_financial_user_id ON public.financial_entries(user_id);
CREATE INDEX idx_financial_client_id ON public.financial_entries(client_id);
CREATE INDEX idx_financial_status ON public.financial_entries(status);
CREATE INDEX idx_financial_type ON public.financial_entries(type);
CREATE INDEX idx_financial_due_date ON public.financial_entries(due_date);

CREATE TRIGGER update_financial_updated_at BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TABELA: projects (escala futura)
-- =============================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'briefing',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TABELA: tasks (escala futura)
-- =============================================

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'pendente',
  priority task_priority NOT NULL DEFAULT 'media',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TABELA: files (escala futura)
-- =============================================

CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  demand_id UUID REFERENCES public.demands(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.files FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- TABELA: client_feedback (escala futura)
-- =============================================

CREATE TABLE public.client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  demand_id UUID REFERENCES public.demands(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status feedback_status NOT NULL DEFAULT 'enviado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON public.client_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.client_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON public.client_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback" ON public.client_feedback FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- FUNÇÕES RPC PARA DASHBOARD
-- =============================================

-- Resumo financeiro
CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'receita_total', COALESCE((SELECT SUM(amount) FROM public.financial_entries WHERE user_id = auth.uid() AND type = 'entrada' AND status = 'pago'), 0),
    'despesas_total', COALESCE((SELECT SUM(amount) FROM public.financial_entries WHERE user_id = auth.uid() AND type = 'saida' AND status = 'pago'), 0),
    'lucro', COALESCE((SELECT SUM(amount) FROM public.financial_entries WHERE user_id = auth.uid() AND type = 'entrada' AND status = 'pago'), 0) - COALESCE((SELECT SUM(amount) FROM public.financial_entries WHERE user_id = auth.uid() AND type = 'saida' AND status = 'pago'), 0),
    'a_receber', COALESCE((SELECT SUM(amount) FROM public.financial_entries WHERE user_id = auth.uid() AND type = 'entrada' AND status IN ('pendente', 'atrasado')), 0)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Resumo de demandas
CREATE OR REPLACE FUNCTION public.get_demands_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pendentes', (SELECT COUNT(*) FROM public.demands WHERE user_id = auth.uid() AND status = 'pendente'),
    'em_andamento', (SELECT COUNT(*) FROM public.demands WHERE user_id = auth.uid() AND status = 'em_andamento'),
    'em_revisao', (SELECT COUNT(*) FROM public.demands WHERE user_id = auth.uid() AND status = 'revisao'),
    'finalizadas', (SELECT COUNT(*) FROM public.demands WHERE user_id = auth.uid() AND status = 'finalizado'),
    'atrasadas', (SELECT COUNT(*) FROM public.demands WHERE user_id = auth.uid() AND due_date < CURRENT_DATE AND status != 'finalizado'),
    'proximas_entregas', (SELECT json_agg(row_to_json(d)) FROM (
      SELECT id, title, due_date, status, priority
      FROM public.demands
      WHERE user_id = auth.uid() AND status != 'finalizado' AND due_date >= CURRENT_DATE
      ORDER BY due_date ASC LIMIT 5
    ) d)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Próximos pagamentos
CREATE OR REPLACE FUNCTION public.get_upcoming_payments()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(f)) INTO result FROM (
    SELECT id, description, amount, type, due_date, status
    FROM public.financial_entries
    WHERE user_id = auth.uid() AND status = 'pendente' AND due_date >= CURRENT_DATE
    ORDER BY due_date ASC LIMIT 10
  ) f;
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
