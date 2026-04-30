-- Tabela de conexões OAuth do Mercado Pago por usuário (multi-tenant)
CREATE TABLE public.mp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mp_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  public_key TEXT,
  live_mode BOOLEAN NOT NULL DEFAULT false,
  scope TEXT,
  token_type TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mp_connections ENABLE ROW LEVEL SECURITY;

-- Apenas leitura pelo dono. NUNCA permitir INSERT/UPDATE direto do client
-- (tokens só podem ser gravados pela edge function com service role).
CREATE POLICY "Users can view own mp_connection"
  ON public.mp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mp_connection"
  ON public.mp_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_mp_connections_updated_at
  BEFORE UPDATE ON public.mp_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tabela auxiliar para o state do OAuth (CSRF + vínculo com user)
CREATE TABLE public.mp_oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY;
-- Sem políticas públicas: só a edge function (service role) acessa.