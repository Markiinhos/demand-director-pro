import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/integrations/supabase/types.ts');
let content = fs.readFileSync(file, 'utf-8');

const newTables = `
      ai_actions: {
        Row: {
          id: string; created_at: string; updated_at?: string;
          user_id: string; conversation_id?: string; tool_name: string;
          arguments: Json; status: string; risk_level?: string;
          requires_approval: boolean; executed_at?: string; approved_at?: string;
          idempotency_key?: string | null;
        }
        Insert: any
        Update: any
        Relationships: []
      }
      ai_conversations: { Row: any, Insert: any, Update: any, Relationships: [] }
      ai_messages: { Row: any, Insert: any, Update: any, Relationships: [] }
      ai_agents: { Row: any, Insert: any, Update: any, Relationships: [] }
      ai_knowledge: { Row: any, Insert: any, Update: any, Relationships: [] }
      ai_routines: { 
        Row: {
          id: string; user_id: string; client_id?: string | null;
          name: string; routine_type: string; schedule: string;
          configuration: Json; is_active: boolean; requires_approval: boolean;
          last_run_at?: string; next_run_at?: string; channel?: string;
          idempotency_key?: string;
          clients?: { name: string };
        }
        Insert: any, Update: any, Relationships: [] 
      }
      ai_usage_logs: { Row: any, Insert: any, Update: any, Relationships: [] }
      ai_events: { Row: any, Insert: any, Update: any, Relationships: [] }
      compliance_obligations: { 
        Row: {
          id: string; user_id: string; client_id?: string | null;
          title: string; category: string; description?: string;
          responsible_name?: string; periodicity?: string;
          due_date?: string; status: string; risk_level?: string;
          official_source?: string; last_verified?: string; next_revision?: string;
          clients?: { name: string };
        }
        Insert: any, Update: any, Relationships: [] 
      }
      meetings: { Row: any, Insert: any, Update: any, Relationships: [] }
      chatgpt_integrations: { Row: any, Insert: any, Update: any, Relationships: [] }
`;

// Simple hack: find "Enums: {" and insert before it
content = content.replace("    },\n    Enums: {", newTables + "\n    },\n    Enums: {");
// Also some Enums might be "    Enums: {" or "    Enums: {"
if (content.indexOf(newTables) === -1) {
    const enumPattern = /Enums: {/g;
    content = content.replace(enumPattern, newTables + "\n    Enums: {");
}

fs.writeFileSync(file, content);
console.log("Updated types.ts successfully.");
