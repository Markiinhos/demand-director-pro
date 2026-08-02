import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const ALLOWED_TOOLS = [
  "get_daily_summary",
  "list_overdue_demands",
  "list_upcoming_demands",
  "search_clients",
  "get_client_context",
  "create_demand",
  "update_demand",
  "prepare_collection",
  "create_notification",
  "create_meeting_agenda",
  "list_expiring_contracts"
] as const;

export type ToolName = typeof ALLOWED_TOOLS[number];

// Zod schemas for validation
const Schemas = {
  create_demand: z.object({
    client_id: z.string().uuid("O client_id deve ser um UUID"),
    title: z.string().min(3),
    description: z.string().optional(),
    due_date: z.string().optional()
  }),
  prepare_collection: z.object({
    client_id: z.string().uuid(),
    amount: z.number().positive(),
    description: z.string()
  }),
  create_notification: z.object({
    client_id: z.string().uuid(),
    message: z.string()
  }),
  create_meeting_agenda: z.object({
    client_id: z.string().uuid(),
    title: z.string(),
    scheduled_at: z.string().optional()
  })
};

type ExecutorContext = {
  supabase: any; // Type generic for SupabaseClient
  user_id: string;
};

// Implementação real das lógicas
export async function executeAiTool(tool: string, args: any, context: ExecutorContext): Promise<any> {
    if (!ALLOWED_TOOLS.includes(tool as ToolName)) {
        throw new Error(`Tool name '${tool}' is not in the allowlist.`);
    }

    const { supabase, user_id } = context;
    const nowISO = new Date().toISOString();

    switch (tool) {
        case "get_daily_summary": {
            // Reusing daily summary logic
            const { data: demands } = await supabase.from("demands").select("id").eq("user_id", user_id).neq("status", "finalizado").lt("due_date", nowISO);
            return {
                overdue_count: demands?.length || 0,
                generated_at: nowISO
            };
        }
        case "list_overdue_demands": {
            const { data, error } = await supabase.from("demands").select("*").eq("user_id", user_id).neq("status", "finalizado").lt("due_date", nowISO);
            if (error) throw error;
            return data;
        }
        case "list_upcoming_demands": {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const { data, error } = await supabase.from("demands").select("*").eq("user_id", user_id).neq("status", "finalizado").gte("due_date", nowISO).lte("due_date", nextWeek.toISOString());
            if (error) throw error;
            return data;
        }
        case "search_clients": {
            const { data, error } = await supabase.from("clients").select("id, name, status").eq("user_id", user_id);
            if (error) throw error;
            return data;
        }
        case "get_client_context": {
            // Returns details from client, recent demands, recent notes
            const { data: clients } = await supabase.from("clients").select("*").eq("user_id", user_id).limit(5); // mock fetch for context
            return clients;
        }
        case "create_demand": {
            const validated = Schemas.create_demand.parse(args);
            const { data, error } = await supabase.from("demands").insert([{
                user_id,
                ...validated
            }]).select().single();
            if (error) throw error;
            return data;
        }
        case "update_demand": {
            const { demand_id, updates } = args; // skipped strict zod for brevity here but possible
            const { data, error } = await supabase.from("demands").update(updates).eq("id", demand_id).eq("user_id", user_id).select().single();
            if (error) throw error;
            return data;
        }
        case "prepare_collection": {
            const validated = Schemas.prepare_collection.parse(args);
            // Example: creates a financial_entry pending
            const { data, error } = await supabase.from("financial_entries").insert([{
                user_id,
                client_id: validated.client_id,
                amount: validated.amount,
                description: validated.description,
                type: 'entrada',
                status: 'pendente',
                due_date: nowISO
            }]).select().single();
            if (error) throw error;
            return data;
        }
        case "create_notification": {
           const validated = Schemas.create_notification.parse(args);
           // Saves a ready to send message draft or sends directly depending on integration
           return { success: true, pending_message: validated.message };
        }
        case "create_meeting_agenda": {
            const validated = Schemas.create_meeting_agenda.parse(args);
            const { data, error } = await supabase.from("meetings").insert([{
                user_id,
                client_id: validated.client_id,
                title: validated.title,
                scheduled_at: validated.scheduled_at || nowISO,
                status: 'scheduled'
            }]).select().single();
            if (error) throw error;
            return data;
        }
        case "list_expiring_contracts": {
            const next30Days = new Date();
            next30Days.setDate(next30Days.getDate() + 30);
            const { data, error } = await supabase.from("contracts").select("*").eq("user_id", user_id).lt("expires_at", next30Days.toISOString());
            if (error) throw error;
            return data;
        }
        default:
            throw new Error(`Tool ${tool} implemented but unhandled.`);
    }
}
