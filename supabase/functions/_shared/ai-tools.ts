// =====================================================================
// EXECUTOR CENTRAL DE FERRAMENTAS DO GESTOR OPERACIONAL
// Usado por: ai-agent, ai-execute-action, chatgpt-actions,
//            whatsapp-agent, ai-routine-runner
// =====================================================================
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export type Risk = "low" | "medium" | "high";

export type AccessRole =
  | "owner"
  | "manager"
  | "collaborator"
  | "client"
  | "lead"
  | "unknown";

export type Channel =
  | "internal_chat"
  | "chatgpt_action"
  | "whatsapp_admin"
  | "whatsapp_client"
  | "automation";

export type ToolContext = {
  supabase: any;
  user_id: string;
  channel: Channel;
  role?: AccessRole;
  /** cliente vinculado ao solicitante (papel client/lead) */
  scoped_client_id?: string | null;
  external_identifier?: string | null;
  conversation_id?: string | null;
};

export type ToolDef = {
  name: string;
  risk: Risk;
  description: string;
  financial?: boolean;
  schema: z.ZodTypeAny;
  execute: (args: any, ctx: ToolContext) => Promise<any>;
};

const ROLE_MAX_RISK: Record<AccessRole, Risk | null> = {
  owner: "high",
  manager: "medium",
  collaborator: "medium",
  client: "low",
  lead: null,
  unknown: null,
};

const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const Empty = z.object({}).passthrough();

function ok<T>(data: T) {
  return data ?? null;
}

// ---------------------------------------------------------------------
// CONSULTAS DE BAIXO RISCO
// ---------------------------------------------------------------------
const lowRiskTools: ToolDef[] = [
  {
    name: "get_daily_priorities",
    risk: "low",
    description: "Prioridades do dia: demandas atrasadas, entregas de hoje, pagamentos vencidos e aprovações pendentes.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const t = today();
      const [overdue, dueToday, latePayments, pending] = await Promise.all([
        supabase.from("demands").select("id,title,due_date,status,priority,client_id").eq("user_id", user_id).neq("status", "finalizado").lt("due_date", t),
        supabase.from("demands").select("id,title,due_date,status,priority,client_id").eq("user_id", user_id).neq("status", "finalizado").eq("due_date", t),
        supabase.from("financial_entries").select("id,description,amount,due_date,status").eq("user_id", user_id).eq("type", "entrada").neq("status", "pago").lt("due_date", t),
        supabase.from("ai_actions").select("id,tool_name,risk_level,created_at").eq("user_id", user_id).eq("status", "pending_approval"),
      ]);
      return {
        date: t,
        overdue_demands: overdue.data ?? [],
        due_today: dueToday.data ?? [],
        overdue_payments: latePayments.data ?? [],
        pending_approvals: pending.data ?? [],
      };
    },
  },
  {
    name: "get_weekly_priorities",
    risk: "low",
    description: "Prioridades dos próximos 7 dias.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const [demands, charges, meetings] = await Promise.all([
        supabase.from("demands").select("id,title,due_date,status,priority,client_id").eq("user_id", user_id).neq("status", "finalizado").gte("due_date", today()).lte("due_date", daysFromNow(7)).order("due_date"),
        supabase.from("payment_charges").select("id,description,amount,due_date,status").eq("user_id", user_id).neq("status", "paid").lte("due_date", daysFromNow(7)),
        supabase.from("meetings").select("id,title,scheduled_at,status,client_id").eq("user_id", user_id).gte("scheduled_at", nowISO()).lte("scheduled_at", new Date(Date.now() + 7 * 86400000).toISOString()),
      ]);
      return { demands: demands.data ?? [], charges: charges.data ?? [], meetings: meetings.data ?? [] };
    },
  },
  {
    name: "get_daily_summary",
    risk: "low",
    description: "Resumo numérico do dia (contagens).",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const t = today();
      const count = async (q: any) => (await q).count ?? 0;
      const base = () => supabase.from("demands").select("id", { count: "exact", head: true }).eq("user_id", user_id);
      return {
        generated_at: nowISO(),
        overdue_count: await count(base().neq("status", "finalizado").lt("due_date", t)),
        due_today_count: await count(base().neq("status", "finalizado").eq("due_date", t)),
        in_progress_count: await count(base().eq("status", "em_andamento")),
        pending_approvals: await count(supabase.from("ai_actions").select("id", { count: "exact", head: true }).eq("user_id", user_id).eq("status", "pending_approval")),
      };
    },
  },
  {
    name: "list_overdue_demands",
    risk: "low",
    description: "Lista demandas atrasadas.",
    schema: Empty,
    execute: async (_a, { supabase, user_id, scoped_client_id }) => {
      let q = supabase.from("demands").select("id,title,due_date,status,priority,client_id").eq("user_id", user_id).neq("status", "finalizado").lt("due_date", today()).order("due_date");
      if (scoped_client_id) q = q.eq("client_id", scoped_client_id);
      const { data, error } = await q;
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_upcoming_demands",
    risk: "low",
    description: "Demandas com entrega nos próximos 7 dias.",
    schema: z.object({ days: z.number().int().positive().max(90).nullable().default(7) }).partial(),
    execute: async (a, { supabase, user_id, scoped_client_id }) => {
      let q = supabase.from("demands").select("id,title,due_date,status,priority,client_id").eq("user_id", user_id).neq("status", "finalizado").gte("due_date", today()).lte("due_date", daysFromNow(a?.days || 7)).order("due_date");
      if (scoped_client_id) q = q.eq("client_id", scoped_client_id);
      const { data, error } = await q;
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "search_clients",
    risk: "low",
    description: "Busca clientes por nome. Use antes de qualquer ação que precise de client_id.",
    schema: z.object({ query: z.string().nullable() }).partial(),
    execute: async (a, { supabase, user_id, scoped_client_id }) => {
      let q = supabase.from("clients").select("id,name,contact_name,phone,email,status,type,lead_stage").eq("user_id", user_id).limit(25);
      if (a?.query) q = q.ilike("name", `%${a.query}%`);
      if (scoped_client_id) q = q.eq("id", scoped_client_id);
      const { data, error } = await q;
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "get_client_context",
    risk: "low",
    description: "Contexto completo de um cliente: dados, demandas recentes, financeiro e interações.",
    schema: z.object({ client_id: z.string().uuid() }),
    execute: async (a, { supabase, user_id, scoped_client_id }) => {
      if (scoped_client_id && scoped_client_id !== a.client_id) throw new Error("forbidden_client_scope");
      const { data: client, error } = await supabase.from("clients").select("*").eq("user_id", user_id).eq("id", a.client_id).maybeSingle();
      if (error) throw error;
      if (!client) throw new Error("Cliente não encontrado.");
      const [demands, finance, interactions] = await Promise.all([
        supabase.from("demands").select("id,title,status,due_date,priority").eq("user_id", user_id).eq("client_id", a.client_id).order("due_date", { ascending: false }).limit(10),
        supabase.from("financial_entries").select("id,description,amount,type,status,due_date").eq("user_id", user_id).eq("client_id", a.client_id).order("due_date", { ascending: false }).limit(10),
        supabase.from("client_interactions").select("id,interaction_type,description,interaction_date").eq("user_id", user_id).eq("client_id", a.client_id).order("interaction_date", { ascending: false }).limit(5),
      ]);
      return { client, demands: demands.data ?? [], financial: finance.data ?? [], interactions: interactions.data ?? [] };
    },
  },
  {
    name: "list_pending_client_actions",
    risk: "low",
    description: "Clientes/leads com próxima ação vencida ou para hoje.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("clients").select("id,name,next_action,next_action_date,lead_stage").eq("user_id", user_id).not("next_action_date", "is", null).lte("next_action_date", today()).order("next_action_date");
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_due_collections",
    risk: "low",
    financial: true,
    description: "Cobranças a vencer nos próximos dias.",
    schema: z.object({ days: z.number().int().positive().max(90).nullable() }).partial(),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("payment_charges").select("id,client_id,description,amount,due_date,status,payment_link").eq("user_id", user_id).neq("status", "paid").lte("due_date", daysFromNow(a?.days || 10)).order("due_date");
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_overdue_payments",
    risk: "low",
    financial: true,
    description: "Pagamentos vencidos e não recebidos.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("financial_entries").select("id,client_id,description,amount,type,status,due_date").eq("user_id", user_id).eq("type", "entrada").neq("status", "pago").lt("due_date", today()).order("due_date");
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_unsigned_contracts",
    risk: "low",
    description: "Contratos ainda não assinados.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("contracts").select("id,client_id,title,status,created_at").eq("user_id", user_id).in("status", ["draft", "sent"]).order("created_at", { ascending: false });
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_expiring_contracts",
    risk: "low",
    description: "Contratos enviados há mais de 30 dias e ainda sem assinatura (risco de caducar).",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase.from("contracts").select("id,client_id,title,status,created_at").eq("user_id", user_id).eq("status", "sent").lt("created_at", cutoff);
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_upcoming_meetings",
    risk: "low",
    description: "Próximas reuniões agendadas.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("meetings").select("*").eq("user_id", user_id).gte("scheduled_at", nowISO()).order("scheduled_at").limit(20);
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_compliance_obligations",
    risk: "low",
    description: "Obrigações administrativas pendentes ou vencidas.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("compliance_obligations").select("*").eq("user_id", user_id).neq("status", "concluido").order("due_date");
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "list_pending_ai_actions",
    risk: "low",
    description: "Ações do agente aguardando aprovação.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("ai_actions").select("id,tool_name,arguments,risk_level,channel,created_at,confirmation_expires_at").eq("user_id", user_id).eq("status", "pending_approval").order("created_at", { ascending: false });
      if (error) throw error;
      return ok(data);
    },
  },
  {
    name: "get_agency_metrics",
    risk: "low",
    financial: true,
    description: "Métricas gerais da agência: clientes, demandas e financeiro.",
    schema: Empty,
    execute: async (_a, { supabase, user_id }) => {
      const [clients, demands, entries] = await Promise.all([
        supabase.from("clients").select("id,status,type").eq("user_id", user_id),
        supabase.from("demands").select("id,status").eq("user_id", user_id),
        supabase.from("financial_entries").select("amount,type,status").eq("user_id", user_id),
      ]);
      const e = entries.data ?? [];
      const sum = (t: string, s?: string) => e.filter((x: any) => x.type === t && (!s || x.status === s)).reduce((acc: number, x: any) => acc + Number(x.amount || 0), 0);
      return {
        clients_total: clients.data?.length ?? 0,
        clients_active: clients.data?.filter((c: any) => c.status === "ativo").length ?? 0,
        demands_total: demands.data?.length ?? 0,
        demands_open: demands.data?.filter((d: any) => d.status !== "finalizado").length ?? 0,
        revenue_received: sum("entrada", "pago"),
        revenue_pending: sum("entrada") - sum("entrada", "pago"),
        expenses_paid: sum("saida", "pago"),
      };
    },
  },
];

// ---------------------------------------------------------------------
// AÇÕES DE MÉDIO RISCO
// ---------------------------------------------------------------------
async function assertClient(supabase: any, user_id: string, client_id: string) {
  const { data } = await supabase.from("clients").select("id,name,phone").eq("user_id", user_id).eq("id", client_id).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado ou não pertence a esta conta.");
  return data;
}

const mediumRiskTools: ToolDef[] = [
  {
    name: "create_demand",
    risk: "medium",
    description: "Cria uma nova demanda para um cliente.",
    schema: z.object({
      client_id: z.string().uuid(),
      title: z.string().min(3),
      description: z.string().nullable(),
      due_date: z.string().min(8),
      type: z.enum(["post", "logo", "banner", "personalizado", "outro"]).nullable(),
      priority: z.enum(["baixa", "media", "alta", "urgente"]).nullable(),
    }).partial({ description: true, type: true, priority: true }),
    execute: async (a, { supabase, user_id }) => {
      await assertClient(supabase, user_id, a.client_id);
      const { data, error } = await supabase.from("demands").insert([{
        user_id,
        client_id: a.client_id,
        title: a.title,
        description: a.description ?? null,
        due_date: a.due_date.slice(0, 10),
        type: a.type ?? "personalizado",
        priority: a.priority ?? "media",
        status: "pendente",
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "update_demand",
    risk: "medium",
    description: "Atualiza campos de uma demanda existente.",
    schema: z.object({
      demand_id: z.string().uuid(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      status: z.enum(["pendente", "em_andamento", "revisao", "finalizado"]).nullable(),
      priority: z.enum(["baixa", "media", "alta", "urgente"]).nullable(),
      due_date: z.string().nullable(),
    }).partial(),
    execute: async (a, { supabase, user_id }) => {
      const updates: Record<string, unknown> = {};
      for (const k of ["title", "description", "status", "priority"]) if (a[k] != null) updates[k] = a[k];
      if (a.due_date) updates.due_date = String(a.due_date).slice(0, 10);
      if (!Object.keys(updates).length) throw new Error("Nenhum campo para atualizar.");
      const { data, error } = await supabase.from("demands").update(updates).eq("id", a.demand_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "reschedule_demand",
    risk: "medium",
    description: "Altera a data de entrega de uma demanda.",
    schema: z.object({ demand_id: z.string().uuid(), due_date: z.string().min(8), reason: z.string().nullable() }).partial({ reason: true }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("demands").update({ due_date: a.due_date.slice(0, 10) }).eq("id", a.demand_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "create_notification",
    risk: "medium",
    description: "Cria uma notificação interna no painel.",
    schema: z.object({ title: z.string().min(2), message: z.string().nullable(), link: z.string().nullable(), client_id: z.string().uuid().nullable() }).partial({ message: true, link: true, client_id: true }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("notifications").insert([{
        user_id, title: a.title, message: a.message ?? null, type: "info", link: a.link ?? null,
        related_entity_type: a.client_id ? "client" : null, related_entity_id: a.client_id ?? null,
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "create_meeting_agenda",
    risk: "medium",
    description: "Cria uma reunião com pauta organizada.",
    schema: z.object({ client_id: z.string().uuid().nullable(), title: z.string().min(3), agenda: z.string().nullable(), scheduled_at: z.string().nullable() }).partial({ client_id: true, agenda: true, scheduled_at: true }),
    execute: async (a, { supabase, user_id }) => {
      if (a.client_id) await assertClient(supabase, user_id, a.client_id);
      const { data, error } = await supabase.from("meetings").insert([{
        user_id, client_id: a.client_id ?? null, title: a.title, agenda: a.agenda ?? null,
        scheduled_at: a.scheduled_at || nowISO(), status: "scheduled",
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "process_meeting_notes",
    risk: "medium",
    description: "Salva as anotações/resultados de uma reunião e a marca como concluída.",
    schema: z.object({ meeting_id: z.string().uuid(), notes: z.string().min(3) }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("meetings").update({ notes: a.notes, status: "done" }).eq("id", a.meeting_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "prepare_collection",
    risk: "medium",
    financial: true,
    description: "Prepara uma cobrança (lançamento financeiro pendente) para um cliente.",
    schema: z.object({ client_id: z.string().uuid(), amount: z.number().positive(), description: z.string().min(3), due_date: z.string().nullable() }).partial({ due_date: true }),
    execute: async (a, { supabase, user_id }) => {
      await assertClient(supabase, user_id, a.client_id);
      const { data, error } = await supabase.from("financial_entries").insert([{
        user_id, client_id: a.client_id, amount: a.amount, description: a.description,
        type: "entrada", status: "pendente", due_date: (a.due_date || today()).slice(0, 10),
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "prepare_contract",
    risk: "medium",
    description: "Cria um contrato em rascunho para o cliente.",
    schema: z.object({ client_id: z.string().uuid(), title: z.string().min(3), template_id: z.string().uuid().nullable(), variables: z.record(z.any()).nullable() }).partial({ template_id: true, variables: true }),
    execute: async (a, { supabase, user_id }) => {
      await assertClient(supabase, user_id, a.client_id);
      const { data, error } = await supabase.from("contracts").insert([{
        user_id, client_id: a.client_id, title: a.title, template_id: a.template_id ?? null,
        variables: a.variables ?? {}, status: "draft",
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "create_client_content_plan",
    risk: "medium",
    description: "Cria um plano de conteúdo: registra o plano na base de conhecimento e abre as demandas correspondentes.",
    schema: z.object({
      client_id: z.string().uuid(),
      title: z.string().min(3),
      items: z.array(z.object({ title: z.string(), due_date: z.string(), description: z.string().nullable() }).partial({ description: true })),
    }),
    execute: async (a, { supabase, user_id }) => {
      await assertClient(supabase, user_id, a.client_id);
      const { data: knowledge } = await supabase.from("ai_knowledge").insert([{
        user_id, client_id: a.client_id, title: a.title,
        content: a.items.map((i: any) => `- ${i.due_date}: ${i.title}`).join("\n"), tags: ["plano_de_conteudo"],
      }]).select().single();
      const rows = a.items.map((i: any) => ({
        user_id, client_id: a.client_id, title: i.title, description: i.description ?? null,
        due_date: String(i.due_date).slice(0, 10), type: "post", priority: "media", status: "pendente",
      }));
      const { data: demands, error } = await supabase.from("demands").insert(rows).select();
      if (error) throw error;
      return { knowledge, demands };
    },
  },
  {
    name: "create_compliance_obligation",
    risk: "medium",
    description: "Registra uma obrigação administrativa/fiscal.",
    schema: z.object({ title: z.string().min(3), description: z.string().nullable(), category: z.string().nullable(), due_date: z.string().nullable(), client_id: z.string().uuid().nullable() }).partial({ description: true, category: true, due_date: true, client_id: true }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("compliance_obligations").insert([{
        user_id, client_id: a.client_id ?? null, title: a.title, description: a.description ?? null,
        category: a.category ?? null, due_date: a.due_date ? String(a.due_date).slice(0, 10) : null, status: "pendente",
      }]).select().single();
      if (error) throw error;
      return data;
    },
  },
];

// ---------------------------------------------------------------------
// AÇÕES DE ALTO RISCO
// ---------------------------------------------------------------------
const highRiskTools: ToolDef[] = [
  {
    name: "send_whatsapp_message",
    risk: "high",
    description: "Envia uma mensagem de WhatsApp para um cliente. Exige aprovação explícita.",
    schema: z.object({ client_id: z.string().uuid(), message: z.string().min(1), reason: z.string().nullable() }).partial({ reason: true }),
    execute: async (a, { supabase, user_id }) => {
      const client = await assertClient(supabase, user_id, a.client_id);
      if (!client.phone) throw new Error("Cliente sem telefone cadastrado.");
      const { sendWhatsApp } = await import("./whatsapp-provider.ts");
      return await sendWhatsApp(supabase, user_id, {
        to: client.phone, content: a.message, client_id: a.client_id,
        related_entity_type: "ai_action", metadata: { reason: a.reason ?? null },
      });
    },
  },
  {
    name: "send_email",
    risk: "high",
    description: "Envia um e-mail para o cliente. Requer provedor de e-mail configurado.",
    schema: z.object({ client_id: z.string().uuid(), subject: z.string().min(1), body: z.string().min(1) }),
    execute: async () => {
      return { status: "provider_not_configured", message: "Nenhum provedor de e-mail configurado nesta conta." };
    },
  },
  {
    name: "send_collection",
    risk: "high",
    financial: true,
    description: "Envia uma cobrança já existente ao cliente pelo WhatsApp.",
    schema: z.object({ charge_id: z.string().uuid().nullable(), client_id: z.string().uuid(), message: z.string().nullable() }).partial({ charge_id: true, message: true }),
    execute: async (a, { supabase, user_id }) => {
      const client = await assertClient(supabase, user_id, a.client_id);
      if (!client.phone) throw new Error("Cliente sem telefone cadastrado.");
      let text = a.message;
      if (a.charge_id) {
        const { data: charge } = await supabase.from("payment_charges").select("*").eq("id", a.charge_id).eq("user_id", user_id).maybeSingle();
        if (!charge) throw new Error("Cobrança não encontrada.");
        text = text || `Olá! Segue a cobrança de ${charge.description || "serviços"}: R$ ${Number(charge.amount).toFixed(2)}${charge.payment_link ? `\nPague aqui: ${charge.payment_link}` : ""}`;
      }
      if (!text) throw new Error("Mensagem de cobrança vazia.");
      const { sendWhatsApp } = await import("./whatsapp-provider.ts");
      return await sendWhatsApp(supabase, user_id, {
        to: client.phone, content: text, client_id: a.client_id,
        related_entity_type: "payment_charge", related_entity_id: a.charge_id ?? null,
      });
    },
  },
  {
    name: "send_contract",
    risk: "high",
    description: "Marca o contrato como enviado e o envia ao cliente pelo WhatsApp.",
    schema: z.object({ contract_id: z.string().uuid(), message: z.string().nullable() }).partial({ message: true }),
    execute: async (a, { supabase, user_id }) => {
      const { data: contract } = await supabase.from("contracts").select("*").eq("id", a.contract_id).eq("user_id", user_id).maybeSingle();
      if (!contract) throw new Error("Contrato não encontrado.");
      const client = await assertClient(supabase, user_id, contract.client_id);
      const { error } = await supabase.from("contracts").update({ status: "sent" }).eq("id", a.contract_id).eq("user_id", user_id);
      if (error) throw error;
      let sent: any = { status: "not_sent", reason: "cliente sem telefone" };
      if (client.phone) {
        const { sendWhatsApp } = await import("./whatsapp-provider.ts");
        sent = await sendWhatsApp(supabase, user_id, {
          to: client.phone,
          content: a.message || `Olá! Segue o contrato "${contract.title}" para sua análise e assinatura.${contract.generated_pdf_url ? `\n${contract.generated_pdf_url}` : ""}`,
          client_id: contract.client_id, related_entity_type: "contract", related_entity_id: a.contract_id,
        });
      }
      return { contract_id: a.contract_id, status: "sent", whatsapp: sent };
    },
  },
  {
    name: "mark_payment_as_received",
    risk: "high",
    financial: true,
    description: "Marca um lançamento financeiro como pago.",
    schema: z.object({ entry_id: z.string().uuid() }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("financial_entries").update({ status: "pago", paid_at: nowISO() }).eq("id", a.entry_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "update_financial_value",
    risk: "high",
    financial: true,
    description: "Altera o valor de um lançamento financeiro.",
    schema: z.object({ entry_id: z.string().uuid(), amount: z.number().positive() }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("financial_entries").update({ amount: a.amount }).eq("id", a.entry_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "cancel_contract",
    risk: "high",
    description: "Cancela um contrato.",
    schema: z.object({ contract_id: z.string().uuid(), reason: z.string().nullable() }).partial({ reason: true }),
    execute: async (a, { supabase, user_id }) => {
      const { data, error } = await supabase.from("contracts").update({ status: "cancelled" }).eq("id", a.contract_id).eq("user_id", user_id).select().single();
      if (error) throw error;
      return data;
    },
  },
  {
    name: "delete_record",
    risk: "high",
    description: "Exclui um registro. Tabelas permitidas: demands, financial_entries, meetings, compliance_obligations, budgets.",
    schema: z.object({
      table: z.enum(["demands", "financial_entries", "meetings", "compliance_obligations", "budgets"]),
      record_id: z.string().uuid(),
    }),
    execute: async (a, { supabase, user_id }) => {
      const { error } = await supabase.from(a.table).delete().eq("id", a.record_id).eq("user_id", user_id);
      if (error) throw error;
      return { deleted: true, table: a.table, id: a.record_id };
    },
  },
];

// ---------------------------------------------------------------------
// REGISTRO
// ---------------------------------------------------------------------
export const TOOL_REGISTRY: Record<string, ToolDef> = Object.fromEntries(
  [...lowRiskTools, ...mediumRiskTools, ...highRiskTools].map((t) => [t.name, t]),
);

export const ALLOWED_TOOLS = Object.keys(TOOL_REGISTRY);

export function getTool(name: string): ToolDef {
  const tool = TOOL_REGISTRY[name];
  if (!tool) throw new Error(`unknown_tool: '${name}' não está na allowlist.`);
  return tool;
}

export function getToolRisk(name: string): Risk {
  return getTool(name).risk;
}

export function requiresApproval(name: string): boolean {
  return getTool(name).risk !== "low";
}

/** Ferramentas visíveis para um papel — usado para montar o catálogo enviado ao modelo. */
export function toolsForRole(role: AccessRole = "owner"): ToolDef[] {
  const max = ROLE_MAX_RISK[role];
  if (!max) return [];
  return Object.values(TOOL_REGISTRY).filter((t) => {
    if (RISK_ORDER[t.risk] > RISK_ORDER[max]) return false;
    if (t.financial && (role === "collaborator" || role === "client" || role === "lead")) return false;
    if ((role === "client" || role === "lead") && t.risk !== "low") return false;
    return true;
  });
}

export function assertRoleCanUse(name: string, role: AccessRole = "owner") {
  const tool = getTool(name);
  const max = ROLE_MAX_RISK[role];
  if (!max) throw new Error("forbidden_role: este número/usuário não tem acesso administrativo.");
  if (RISK_ORDER[tool.risk] > RISK_ORDER[max]) throw new Error(`forbidden_role: papel '${role}' não pode executar '${name}'.`);
  if (tool.financial && ["collaborator", "client", "lead"].includes(role)) throw new Error(`forbidden_role: papel '${role}' não acessa dados financeiros.`);
}

export function validateToolArgs(name: string, args: unknown) {
  const tool = getTool(name);
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) {
    throw new Error(`invalid_arguments: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return parsed.data;
}

/** Executa uma ferramenta com validação de allowlist, papel, schema e propriedade. */
export async function executeAiTool(tool: string, args: any, context: ToolContext): Promise<any> {
  assertRoleCanUse(tool, context.role ?? "owner");
  const validated = validateToolArgs(tool, args);
  return await getTool(tool).execute(validated, context);
}

/** Catálogo em formato de function-calling OpenAI-compatible. */
export function buildToolCatalog(role: AccessRole = "owner") {
  return toolsForRole(role).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: `[risco:${t.risk}] ${t.description}`,
      parameters: zodToJson(t.schema),
    },
  }));
}

// conversão mínima e suficiente de zod -> json schema
function zodToJson(schema: any): any {
  const def = schema?._def;
  if (!def) return { type: "object", properties: {} };
  switch (def.typeName) {
    case "ZodObject": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries<any>(shape)) {
        properties[key] = zodToJson(value);
        if (!isOptional(value)) required.push(key);
      }
      return { type: "object", properties, ...(required.length ? { required } : {}) };
    }
    case "ZodString": return { type: "string" };
    case "ZodNumber": return { type: "number" };
    case "ZodBoolean": return { type: "boolean" };
    case "ZodEnum": return { type: "string", enum: def.values };
    case "ZodArray": return { type: "array", items: zodToJson(def.type) };
    case "ZodRecord": return { type: "object" };
    case "ZodNullable":
    case "ZodOptional":
    case "ZodDefault":
      return zodToJson(def.innerType);
    default: return {};
  }
}

function isOptional(schema: any): boolean {
  const name = schema?._def?.typeName;
  if (name === "ZodOptional" || name === "ZodNullable" || name === "ZodDefault") return true;
  return false;
}
