
-- 1. Fix profiles privilege escalation: prevent self role changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2. mp_connections INSERT/UPDATE policies
CREATE POLICY "Users can insert own mp_connection"
  ON public.mp_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mp_connection"
  ON public.mp_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. mp_oauth_states owner-scoped policies (table had RLS enabled but no policies)
CREATE POLICY "Users manage own mp_oauth_state select"
  ON public.mp_oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own mp_oauth_state insert"
  ON public.mp_oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own mp_oauth_state delete"
  ON public.mp_oauth_states FOR DELETE
  USING (auth.uid() = user_id);
