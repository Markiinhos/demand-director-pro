---
name: Mercado Pago OAuth Multi-tenant
description: Each user connects their own Mercado Pago account via OAuth; tokens stored in mp_connections; webhook resolves token from charge.user_id.
type: feature
---
- Tabela `mp_connections` (1 por user) guarda access_token/refresh_token/mp_user_id/live_mode. RLS: SELECT/DELETE pelo dono. Insert/Update só via service role na edge function.
- Tabela `mp_oauth_states` (CSRF) — sem políticas; só service role.
- Secrets: `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MERCADO_PAGO_WEBHOOK_SECRET`. `MERCADO_PAGO_ACCESS_TOKEN` foi REMOVIDO (não há mais token global).
- Edge function `payments`:
  - `POST /oauth-start` (auth) → cria state e devolve `authorize_url`.
  - `GET /oauth-callback` (público) → troca code por token e faz upsert em mp_connections; HTML postMessage('mp-oauth').
  - `POST /disconnect` (auth) → apaga linha.
  - `GET /config-status` (auth) → conexão do usuário.
  - createPix/Boleto/Link/cancel usam `getUserMPConfig(userId)`.
  - Webhook descobre token via `payment_charges.user_id` (ou primeira conexão como fallback de descoberta de external_reference).
- Frontend: `/integracoes` (page Integracoes.tsx), hook `useMpConnection`, banner em `/cobrancas` se não conectado, item no sidebar.
- Redirect URI registrada no app MP: `https://lwabrwtqwveqrkwegikg.supabase.co/functions/v1/payments/oauth-callback`.
