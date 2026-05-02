const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/public-portal`;

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? "Erro";
    throw new Error(msg);
  }
  return data;
}

export const publicApi = {
  getPortal: (token: string) => call(`/portal/${token}`),
  sendFeedback: (token: string, body: unknown) =>
    call(`/portal/${token}/feedback`, { method: "POST", body: JSON.stringify(body) }),
  getBriefing: (token: string) => call(`/briefing/${token}`),
  submitBriefing: (token: string, body: unknown) =>
    call(`/briefing/${token}/submit`, { method: "POST", body: JSON.stringify(body) }),
  getProposal: (slug: string) => call(`/proposal/${slug}`),
  acceptProposal: (slug: string, body: unknown) =>
    call(`/proposal/${slug}/accept`, { method: "POST", body: JSON.stringify(body) }),
};