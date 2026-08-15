
-- 1. Enum de papéis de aplicação
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela de papéis (separada de profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role)
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- 4. Policies em user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 5. Super admins enxergam todos os perfis
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 6. Super admins gerenciam assinaturas de qualquer conta
DROP POLICY IF EXISTS "Super admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Super admins can view all subscriptions" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update any subscription" ON public.user_subscriptions;
CREATE POLICY "Super admins can update any subscription" ON public.user_subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can insert subscriptions" ON public.user_subscriptions;
CREATE POLICY "Super admins can insert subscriptions" ON public.user_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 7. Definir os super admins iniciais
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users
WHERE email IN ('marcosmbwork@gmail.com', 'irismariana.18@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Iris já vem como Pro
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
SELECT id, 'pro', 'active'::subscription_status FROM auth.users
WHERE email = 'irismariana.18@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET plan_id = 'pro', status = 'active'::subscription_status, canceled_at = NULL;
