
DROP POLICY IF EXISTS "Service role can manage events" ON public.payment_events;

-- The webhook edge function uses service_role key which bypasses RLS entirely,
-- so no extra permissive policy is needed.
