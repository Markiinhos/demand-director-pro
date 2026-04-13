
CREATE TABLE public.freelancer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  desired_salary numeric NOT NULL DEFAULT 0,
  weekly_days numeric NOT NULL DEFAULT 5,
  daily_hours numeric NOT NULL DEFAULT 8,
  vacation_weeks numeric NOT NULL DEFAULT 4,
  monthly_costs jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_hour_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.freelancer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own freelancer_settings" ON public.freelancer_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own freelancer_settings" ON public.freelancer_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own freelancer_settings" ON public.freelancer_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own freelancer_settings" ON public.freelancer_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_freelancer_settings_updated_at
  BEFORE UPDATE ON public.freelancer_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
