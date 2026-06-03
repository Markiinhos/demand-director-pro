// Edge Function pública — serve Portal do Cliente, Briefing e Proposta por token
// Sem JWT: validação por token na DB usando service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "client-files";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function extractPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.includes(PUBLIC_MARKER)) return urlOrPath.split(PUBLIC_MARKER)[1].split("?")[0];
  if (urlOrPath.includes(SIGN_MARKER)) return urlOrPath.split(SIGN_MARKER)[1].split("?")[0];
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) return null;
  return urlOrPath.replace(/^\/+/, "");
}

async function signIfStored(urlOrPath: string | null | undefined, expiresIn = 60 * 60 * 24): Promise<string | null> {
  if (!urlOrPath) return null;
  const path = extractPath(urlOrPath);
  if (!path) return urlOrPath;
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPortalByToken(token: string) {
  const sb = admin();
  const { data: t, error } = await sb
    .from("client_portal_tokens")
    .select("*")
    .eq("token", token)
    .eq("revoked", false)
    .maybeSingle();
  if (error || !t) return null;
  if (t.expires_at && new Date(t.expires_at) < new Date()) return null;
  await sb.from("client_portal_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", t.id);
  return t;
}

async function handlePortal(token: string) {
  const sb = admin();
  const t = await getPortalByToken(token);
  if (!t) return json({ error: "Link inválido ou expirado" }, 404);

  const [client, demands, budgets, contracts] = await Promise.all([
    sb.from("clients").select("id,name,contact_name,email,phone").eq("id", t.client_id).maybeSingle(),
    sb.from("demands").select("id,title,description,status,priority,due_date,delivered_at,created_at").eq("client_id", t.client_id).order("created_at", { ascending: false }),
    sb.from("budgets").select("id,title,description,total_amount,status,valid_until,public_slug,accepted_at").eq("client_id", t.client_id).order("created_at", { ascending: false }),
    sb.from("contracts").select("id,title,status,generated_pdf_url,signed_at,created_at").eq("client_id", t.client_id).order("created_at", { ascending: false }),
  ]);

  const demandIds = (demands.data ?? []).map((d) => d.id);
  const versions = demandIds.length
    ? await sb.from("demand_versions").select("*").in("demand_id", demandIds).order("version_number", { ascending: false })
    : { data: [] };
  const feedback = demandIds.length
    ? await sb.from("demand_feedback").select("*").in("demand_id", demandIds).order("created_at", { ascending: false })
    : { data: [] };

  const signedVersions = await Promise.all(
    (versions.data ?? []).map(async (v: any) => ({ ...v, file_url: await signIfStored(v.file_url) })),
  );
  const signedContracts = await Promise.all(
    (contracts.data ?? []).map(async (c: any) => ({ ...c, generated_pdf_url: await signIfStored(c.generated_pdf_url) })),
  );

  return json({
    client: client.data,
    demands: demands.data ?? [],
    versions: signedVersions,
    feedback: feedback.data ?? [],
    budgets: budgets.data ?? [],
    contracts: signedContracts,
  });
}

async function handleFeedback(token: string, body: { demand_id: string; version_id?: string; action: string; comment?: string; author_name?: string }) {
  const sb = admin();
  const t = await getPortalByToken(token);
  if (!t) return json({ error: "Link inválido" }, 404);

  const { data: demand } = await sb.from("demands").select("id,user_id,client_id,status").eq("id", body.demand_id).maybeSingle();
  if (!demand || demand.client_id !== t.client_id) return json({ error: "Demanda não encontrada" }, 404);

  const { error } = await sb.from("demand_feedback").insert({
    user_id: demand.user_id,
    demand_id: demand.id,
    version_id: body.version_id ?? null,
    action: body.action as "approved" | "changes_requested" | "comment",
    comment: body.comment ?? null,
    author_name: body.author_name ?? null,
    source: "portal",
  });
  if (error) return json({ error: error.message }, 400);

  if (body.action === "approved") {
    await sb.from("demands").update({ status: "finalizado", delivered_at: new Date().toISOString() }).eq("id", demand.id);
  } else if (body.action === "changes_requested") {
    await sb.from("demands").update({ status: "em_andamento" }).eq("id", demand.id);
  }
  return json({ ok: true });
}

async function handleBriefingGet(token: string) {
  const sb = admin();
  const { data: b } = await sb.from("briefings").select("id,user_id,client_id,demand_id,title,description,schema,status,expires_at").eq("token", token).maybeSingle();
  if (!b) return json({ error: "Briefing não encontrado" }, 404);
  if (b.expires_at && new Date(b.expires_at) < new Date()) return json({ error: "Briefing expirado" }, 410);
  if (b.status === "archived") return json({ error: "Briefing arquivado" }, 410);
  return json(b);
}

async function handleBriefingSubmit(token: string, body: { answers: Record<string, unknown>; respondent_name?: string; respondent_email?: string }) {
  const sb = admin();
  const { data: b } = await sb.from("briefings").select("*").eq("token", token).maybeSingle();
  if (!b) return json({ error: "Briefing não encontrado" }, 404);

  const { error } = await sb.from("briefing_responses").insert({
    user_id: b.user_id,
    briefing_id: b.id,
    answers: body.answers ?? {},
    respondent_name: body.respondent_name ?? null,
    respondent_email: body.respondent_email ?? null,
  });
  if (error) return json({ error: error.message }, 400);
  await sb.from("briefings").update({ status: "answered" }).eq("id", b.id);
  return json({ ok: true });
}

async function handleProposalGet(slug: string) {
  const sb = admin();
  const { data: budget } = await sb.from("budgets").select("*").eq("public_slug", slug).maybeSingle();
  if (!budget) return json({ error: "Proposta não encontrada" }, 404);
  const [items, client] = await Promise.all([
    sb.from("budget_items").select("*").eq("budget_id", budget.id).order("created_at"),
    sb.from("clients").select("id,name,contact_name").eq("id", budget.client_id).maybeSingle(),
  ]);
  return json({ budget, items: items.data ?? [], client: client.data });
}

async function handleProposalAccept(slug: string, body: { accepted_by_name?: string }) {
  const sb = admin();
  const { data: budget } = await sb.from("budgets").select("*").eq("public_slug", slug).maybeSingle();
  if (!budget) return json({ error: "Proposta não encontrada" }, 404);
  if (budget.accepted_at) return json({ ok: true, already: true });
  const { error } = await sb.from("budgets")
    .update({ accepted_at: new Date().toISOString(), accepted_by_name: body.accepted_by_name ?? null, status: "aceito" })
    .eq("id", budget.id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // /public-portal/portal/:token
    // /public-portal/portal/:token/feedback
    // /public-portal/briefing/:token
    // /public-portal/briefing/:token/submit
    // /public-portal/proposal/:slug
    // /public-portal/proposal/:slug/accept
    const idx = parts.indexOf("public-portal");
    const route = parts.slice(idx + 1);
    const [kind, idOrToken, action] = route;

    if (kind === "portal") {
      if (req.method === "GET") return await handlePortal(idOrToken);
      if (req.method === "POST" && action === "feedback") {
        return await handleFeedback(idOrToken, await req.json());
      }
    }
    if (kind === "briefing") {
      if (req.method === "GET") return await handleBriefingGet(idOrToken);
      if (req.method === "POST" && action === "submit") {
        return await handleBriefingSubmit(idOrToken, await req.json());
      }
    }
    if (kind === "proposal") {
      if (req.method === "GET") return await handleProposalGet(idOrToken);
      if (req.method === "POST" && action === "accept") {
        return await handleProposalAccept(idOrToken, await req.json().catch(() => ({})));
      }
    }
    return json({ error: "Rota não encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});