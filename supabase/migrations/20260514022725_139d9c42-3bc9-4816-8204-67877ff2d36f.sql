
REVOKE ALL ON FUNCTION public.notify_demand_feedback() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_budget_accepted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_payment_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_default_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_plan_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;

-- Keep RPCs callable by signed-in users only (revoke anon)
REVOKE ALL ON FUNCTION public.get_financial_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_demands_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_upcoming_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_demands_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_payments() TO authenticated;
