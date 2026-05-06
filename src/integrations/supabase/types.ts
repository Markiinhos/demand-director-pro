export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      briefing_responses: {
        Row: {
          answers: Json
          briefing_id: string
          id: string
          respondent_email: string | null
          respondent_name: string | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          briefing_id: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          briefing_id?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          client_id: string | null
          created_at: string
          demand_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          schema: Json
          status: Database["public"]["Enums"]["briefing_status"]
          title: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          schema?: Json
          status?: Database["public"]["Enums"]["briefing_status"]
          title: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          schema?: Json
          status?: Database["public"]["Enums"]["briefing_status"]
          title?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          budget_id: string
          created_at: string
          description: string | null
          id: string
          quantity: number
          subtotal: number
          title: string
          unit_price: number
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          subtotal?: number
          title: string
          unit_price?: number
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          subtotal?: number
          title?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          payment_charge_id: string | null
          public_slug: string | null
          status: Database["public"]["Enums"]["budget_status"]
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_charge_id?: string | null
          public_slug?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          title: string
          total_amount?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_charge_id?: string | null
          public_slug?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          title?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      client_feedback: {
        Row: {
          client_id: string
          created_at: string
          demand_id: string | null
          id: string
          message: string
          status: Database["public"]["Enums"]["feedback_status"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          demand_id?: string | null
          id?: string
          message: string
          status?: Database["public"]["Enums"]["feedback_status"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          demand_id?: string | null
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          interaction_date: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          next_step: string | null
          next_step_date: string | null
          responsible: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          next_step?: string | null
          next_step_date?: string | null
          responsible?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          next_step?: string | null
          next_step_date?: string | null
          responsible?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          revoked: boolean
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked?: boolean
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked?: boolean
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          city: string | null
          close_potential: Database["public"]["Enums"]["close_potential"] | null
          contact_name: string | null
          created_at: string
          email: string | null
          first_contact_at: string | null
          id: string
          instagram: string | null
          last_interaction_at: string | null
          lead_source: string | null
          lead_stage: Database["public"]["Enums"]["lead_stage"] | null
          logo_url: string | null
          name: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          phone: string | null
          sales_notes: string | null
          segment: string | null
          service_provided: string | null
          specialty: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          close_potential?:
            | Database["public"]["Enums"]["close_potential"]
            | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          first_contact_at?: string | null
          id?: string
          instagram?: string | null
          last_interaction_at?: string | null
          lead_source?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage"] | null
          logo_url?: string | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          sales_notes?: string | null
          segment?: string | null
          service_provided?: string | null
          specialty?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          close_potential?:
            | Database["public"]["Enums"]["close_potential"]
            | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          first_contact_at?: string | null
          id?: string
          instagram?: string | null
          last_interaction_at?: string | null
          lead_source?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage"] | null
          logo_url?: string | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          sales_notes?: string | null
          segment?: string | null
          service_provided?: string | null
          specialty?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_default: boolean
          name: string
          placeholders: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          is_default?: boolean
          name: string
          placeholders?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_default?: boolean
          name?: string
          placeholders?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          budget_id: string | null
          client_id: string
          created_at: string
          generated_pdf_url: string | null
          id: string
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          budget_id?: string | null
          client_id: string
          created_at?: string
          generated_pdf_url?: string | null
          id?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          budget_id?: string | null
          client_id?: string
          created_at?: string
          generated_pdf_url?: string | null
          id?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      demand_feedback: {
        Row: {
          action: Database["public"]["Enums"]["demand_feedback_action"]
          author_name: string | null
          comment: string | null
          created_at: string
          demand_id: string
          id: string
          source: string
          user_id: string
          version_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["demand_feedback_action"]
          author_name?: string | null
          comment?: string | null
          created_at?: string
          demand_id: string
          id?: string
          source?: string
          user_id: string
          version_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["demand_feedback_action"]
          author_name?: string | null
          comment?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          source?: string
          user_id?: string
          version_id?: string | null
        }
        Relationships: []
      }
      demand_versions: {
        Row: {
          created_at: string
          demand_id: string
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          demand_id: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          user_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          demand_id?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      demands: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          delivered_at: string | null
          description: string | null
          due_date: string
          id: string
          priority: Database["public"]["Enums"]["demand_priority"]
          status: Database["public"]["Enums"]["demand_status"]
          title: string
          type: Database["public"]["Enums"]["demand_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          delivered_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: Database["public"]["Enums"]["demand_priority"]
          status?: Database["public"]["Enums"]["demand_status"]
          title: string
          type?: Database["public"]["Enums"]["demand_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          delivered_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["demand_priority"]
          status?: Database["public"]["Enums"]["demand_status"]
          title?: string
          type?: Database["public"]["Enums"]["demand_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          client_id: string | null
          created_at: string
          demand_id: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          demand_id: string | null
          description: string
          due_date: string | null
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["financial_status"]
          type: Database["public"]["Enums"]["financial_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          type: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          demand_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          type?: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_settings: {
        Row: {
          calculated_hour_rate: number
          created_at: string
          daily_hours: number
          desired_salary: number
          id: string
          monthly_costs: Json
          updated_at: string
          user_id: string
          vacation_weeks: number
          weekly_days: number
        }
        Insert: {
          calculated_hour_rate?: number
          created_at?: string
          daily_hours?: number
          desired_salary?: number
          id?: string
          monthly_costs?: Json
          updated_at?: string
          user_id: string
          vacation_weeks?: number
          weekly_days?: number
        }
        Update: {
          calculated_hour_rate?: number
          created_at?: string
          daily_hours?: number
          desired_salary?: number
          id?: string
          monthly_costs?: Json
          updated_at?: string
          user_id?: string
          vacation_weeks?: number
          weekly_days?: number
        }
        Relationships: []
      }
      mp_connections: {
        Row: {
          access_token: string
          connected_at: string
          expires_at: string | null
          id: string
          live_mode: boolean
          mp_user_id: string
          public_key: string | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id?: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mp_oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payment_charges: {
        Row: {
          amount: number
          bank_slip_url: string | null
          budget_id: string | null
          card_last4: string | null
          client_id: string
          created_at: string
          demand_id: string | null
          description: string | null
          due_date: string | null
          external_reference: string | null
          financial_entry_id: string | null
          id: string
          invoice_url: string | null
          metadata: Json
          paid_at: string | null
          payment_link: string | null
          payment_method: string
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_charge_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_slip_url?: string | null
          budget_id?: string | null
          card_last4?: string | null
          client_id: string
          created_at?: string
          demand_id?: string | null
          description?: string | null
          due_date?: string | null
          external_reference?: string | null
          financial_entry_id?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_link?: string | null
          payment_method: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_charge_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_slip_url?: string | null
          budget_id?: string | null
          card_last4?: string | null
          client_id?: string
          created_at?: string
          demand_id?: string | null
          description?: string | null
          due_date?: string | null
          external_reference?: string | null
          financial_entry_id?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_charge_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          charge_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          provider: string
          user_id: string | null
        }
        Insert: {
          charge_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          provider?: string
          user_id?: string | null
        }
        Update: {
          charge_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "payment_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id: string
          name?: string
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          max_clients: number | null
          max_demands_per_month: number | null
          mp_preapproval_plan_id: string | null
          name: string
          price_brl: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          interval?: string
          is_active?: boolean
          max_clients?: number | null
          max_demands_per_month?: number | null
          mp_preapproval_plan_id?: string | null
          name: string
          price_brl?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          max_clients?: number | null
          max_demands_per_month?: number | null
          mp_preapproval_plan_id?: string | null
          name?: string
          price_brl?: number
          sort_order?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          demand_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demand_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demand_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          completed: boolean
          created_at: string
          current_step: number
          dismissed_at: string | null
          steps_done: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: number
          dismissed_at?: string | null
          steps_done?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: number
          dismissed_at?: string | null
          steps_done?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mp_preapproval_id: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mp_preapproval_id?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mp_preapproval_id?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          access_token_encrypted: string | null
          business_account_id: string | null
          created_at: string
          display_name: string | null
          id: string
          metadata: Json
          phone_number: string | null
          phone_number_id: string
          provider: string
          status: string
          updated_at: string
          user_id: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          business_account_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          phone_number?: string | null
          phone_number_id: string
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          business_account_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          phone_number?: string | null
          phone_number_id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          client_id: string
          content: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string
          metadata: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          template_name: string | null
          updated_at: string
          user_id: string
          wa_message_id: string | null
          whatsapp_connection_id: string | null
        }
        Insert: {
          client_id: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
          user_id: string
          wa_message_id?: string | null
          whatsapp_connection_id?: string | null
        }
        Update: {
          client_id?: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
          user_id?: string
          wa_message_id?: string | null
          whatsapp_connection_id?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          language_code: string
          name: string
          status: string | null
          template_key: string
          updated_at: string
          user_id: string
          variables_schema: Json | null
          whatsapp_connection_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          language_code?: string
          name: string
          status?: string | null
          template_key: string
          updated_at?: string
          user_id: string
          variables_schema?: Json | null
          whatsapp_connection_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          language_code?: string
          name?: string
          status?: string | null
          template_key?: string
          updated_at?: string
          user_id?: string
          variables_schema?: Json | null
          whatsapp_connection_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_demands_summary: { Args: never; Returns: Json }
      get_financial_summary: { Args: never; Returns: Json }
      get_upcoming_payments: { Args: never; Returns: Json }
    }
    Enums: {
      briefing_status: "draft" | "sent" | "answered" | "archived"
      budget_status: "rascunho" | "enviado" | "aprovado" | "recusado" | "aceito"
      client_status: "lead" | "ativo" | "inativo"
      client_type: "cliente" | "lead" | "terceirizado" | "parceiro"
      close_potential: "baixo" | "medio" | "alto"
      contract_status: "draft" | "sent" | "signed" | "cancelled"
      demand_feedback_action: "approved" | "changes_requested" | "comment"
      demand_priority: "baixa" | "media" | "alta" | "urgente"
      demand_status: "pendente" | "em_andamento" | "revisao" | "finalizado"
      demand_type: "post" | "logo" | "banner" | "personalizado" | "outro"
      feedback_status: "enviado" | "aprovado" | "solicitar_ajuste"
      financial_status: "pendente" | "pago" | "atrasado"
      financial_type: "entrada" | "saida"
      interaction_type:
        | "ligacao"
        | "whatsapp"
        | "reuniao"
        | "proposta"
        | "followup"
        | "fechamento"
        | "sem_retorno"
      lead_stage:
        | "novo_lead"
        | "contato_inicial"
        | "briefing"
        | "proposta_enviada"
        | "negociacao"
        | "aprovado"
        | "perdido"
        | "inativo"
      notification_type: "info" | "success" | "warning" | "error"
      profile_role: "admin" | "designer" | "financeiro"
      project_status:
        | "briefing"
        | "criacao"
        | "revisao"
        | "entrega"
        | "concluido"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
      task_priority: "baixa" | "media" | "alta"
      task_status: "pendente" | "fazendo" | "concluida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      briefing_status: ["draft", "sent", "answered", "archived"],
      budget_status: ["rascunho", "enviado", "aprovado", "recusado", "aceito"],
      client_status: ["lead", "ativo", "inativo"],
      client_type: ["cliente", "lead", "terceirizado", "parceiro"],
      close_potential: ["baixo", "medio", "alto"],
      contract_status: ["draft", "sent", "signed", "cancelled"],
      demand_feedback_action: ["approved", "changes_requested", "comment"],
      demand_priority: ["baixa", "media", "alta", "urgente"],
      demand_status: ["pendente", "em_andamento", "revisao", "finalizado"],
      demand_type: ["post", "logo", "banner", "personalizado", "outro"],
      feedback_status: ["enviado", "aprovado", "solicitar_ajuste"],
      financial_status: ["pendente", "pago", "atrasado"],
      financial_type: ["entrada", "saida"],
      interaction_type: [
        "ligacao",
        "whatsapp",
        "reuniao",
        "proposta",
        "followup",
        "fechamento",
        "sem_retorno",
      ],
      lead_stage: [
        "novo_lead",
        "contato_inicial",
        "briefing",
        "proposta_enviada",
        "negociacao",
        "aprovado",
        "perdido",
        "inativo",
      ],
      notification_type: ["info", "success", "warning", "error"],
      profile_role: ["admin", "designer", "financeiro"],
      project_status: [
        "briefing",
        "criacao",
        "revisao",
        "entrega",
        "concluido",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
      task_priority: ["baixa", "media", "alta"],
      task_status: ["pendente", "fazendo", "concluida"],
    },
  },
} as const
