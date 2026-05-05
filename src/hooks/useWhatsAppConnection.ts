import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type WhatsAppConnection = Tables<"whatsapp_connections">;
export type WhatsAppTemplate = Tables<"whatsapp_templates">;

export function useWhatsAppConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connection = useQuery({
    queryKey: ["whatsapp_connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WhatsAppConnection | null;
    },
    enabled: !!user,
  });

  const templates = useQuery({
    queryKey: ["whatsapp_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!user,
  });

  // ── Embedded Signup — primary flow ────────────────────
  const connectViaEmbeddedSignup = useMutation({
    mutationFn: async (input: {
      code: string;
      wabaId?: string;
      phoneNumberId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: {
          code: input.code,
          wabaId: input.wabaId || null,
          phoneNumberId: input.phoneNumberId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      toast.success("WhatsApp Business conectado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao conectar: " + e.message),
  });

  // ── Manual connect — advanced/debug only ──────────────
  const connectManual = useMutation({
    mutationFn: async (input: {
      phoneNumberId: string;
      businessAccountId?: string;
      phoneNumber?: string;
      displayName?: string;
      accessToken: string;
    }) => {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .upsert({
          user_id: user!.id,
          provider: "meta_whatsapp",
          phone_number_id: input.phoneNumberId,
          business_account_id: input.businessAccountId || null,
          phone_number: input.phoneNumber || null,
          display_name: input.displayName || null,
          access_token_encrypted: input.accessToken,
          status: "connected",
          metadata: { connected_via: "manual" },
        }, {
          onConflict: "user_id,phone_number_id",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      toast.success("WhatsApp conectado manualmente.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!connection.data?.id) throw new Error("Nenhuma conexão ativa");
      const { error } = await supabase
        .from("whatsapp_connections")
        .update({ status: "disconnected" })
        .eq("id", connection.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      toast.success("WhatsApp desconectado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const reconnect = useMutation({
    mutationFn: async () => {
      if (!connection.data?.id) throw new Error("Nenhuma conexão");
      const { error } = await supabase
        .from("whatsapp_connections")
        .update({ status: "connected" })
        .eq("id", connection.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      toast.success("WhatsApp reconectado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const testSend = useMutation({
    mutationFn: async () => {
      if (!connection.data?.phone_number_id) throw new Error("Nenhuma conexão ativa");
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          messageId: crypto.randomUUID(),
          phone: connection.data.phone_number || "5511999999999",
          content: "✅ Teste de conexão do DesignOS — se você recebeu esta mensagem, a integração WhatsApp está funcionando!",
          messageType: "text",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Mensagem de teste enviada!"),
    onError: (e) => toast.error("Falha no teste: " + e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async (input: {
      name: string;
      templateKey: string;
      category?: string;
      languageCode?: string;
      variablesSchema?: Record<string, unknown>[];
    }) => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .insert({
          user_id: user!.id,
          whatsapp_connection_id: connection.data?.id || null,
          name: input.name,
          template_key: input.templateKey,
          category: input.category || null,
          language_code: input.languageCode || "pt_BR",
          status: "pending",
          variables_schema: (input.variablesSchema || []) as unknown as import("@/integrations/supabase/types").Json,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_templates"] });
      toast.success("Template salvo");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_templates"] });
      toast.success("Template removido");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return {
    connection: connection.data ?? null,
    isLoading: connection.isLoading,
    isConnected: connection.data?.status === "connected",
    templates: templates.data ?? [],
    connectViaEmbeddedSignup,
    connectManual,
    disconnect,
    reconnect,
    testSend,
    saveTemplate,
    deleteTemplate,
  };
}
