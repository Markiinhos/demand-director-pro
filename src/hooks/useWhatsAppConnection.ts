import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type WhatsAppConnection = Tables<"whatsapp_connections">;
export type WhatsAppTemplate = Tables<"whatsapp_templates">;

const FRONTEND_META_APP_ID = import.meta.env.VITE_META_APP_ID || "";
const FRONTEND_META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || "";

/**
 * Helper to invoke an edge function and handle responses uniformly.
 * Since the Edge Function now always returns HTTP 200, we just
 * check data.success / data.error for logical errors.
 */
async function invokeEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  // If supabase client itself errored (network, timeout, etc.)
  if (error) {
    let detailedMsg = error.message;
    try {
      // Try to extract body from error.context (FunctionsHttpError)
      if ((error as any).context) {
        const bodyData = await (error as any).context.json();
        detailedMsg = bodyData?.error || bodyData?.message || detailedMsg;
        console.error(`❌ [${functionName}] Edge function error body:`, bodyData);
      }
    } catch (_) { /* ignore parse error */ }
    throw new Error(detailedMsg);
  }

  // Logical error from the function (success: false)
  if (data?.success === false || data?.error) {
    const errMsg = data.error || "Erro desconhecido do servidor";
    console.error(`❌ [${functionName}] Logical error:`, data);
    throw new Error(errMsg);
  }

  return data as T;
}

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

  const metaConfig = useQuery({
    queryKey: ["whatsapp_meta_config"],
    queryFn: async () => {
      console.group("🔧 [WhatsApp] Meta Config — fetching...");

      // Use Promise.allSettled so one failure doesn't block the other
      const [statusResult, publicResult] = await Promise.allSettled([
        supabase.functions.invoke("whatsapp-connect", { body: { action: "config-status" } }),
        supabase.functions.invoke("whatsapp-connect", { body: { action: "public-config" } }),
      ]);

      // Extract data from settled results
      let statusData: Record<string, unknown> | null = null;
      let publicData: Record<string, unknown> | null = null;
      let publicError: string | null = null;

      if (statusResult.status === "fulfilled") {
        const { data, error } = statusResult.value;
        if (error) {
          console.warn("⚠ config-status returned error:", error.message);
          // Try to read body from error.context
          try {
            if ((error as any).context) {
              statusData = await (error as any).context.json();
            }
          } catch (_) { /* ignore */ }
        } else {
          statusData = data;
        }
      } else {
        console.error("❌ config-status promise rejected:", statusResult.reason);
      }

      if (publicResult.status === "fulfilled") {
        const { data, error } = publicResult.value;
        if (error) {
          console.warn("⚠ public-config returned error:", error.message);
          publicError = error.message;
          try {
            if ((error as any).context) {
              publicData = await (error as any).context.json();
              publicError = (publicData as any)?.error || publicError;
            }
          } catch (_) { /* ignore */ }
        } else {
          publicData = data;
          // Check for logical error in response
          if (data?.success === false || data?.error) {
            publicError = data.error || "Configuração indisponível";
          }
        }
      } else {
        console.error("❌ public-config promise rejected:", publicResult.reason);
        publicError = "Falha na requisição";
      }

      // Diagnostic log
      console.log("config-status data:", statusData);
      console.log("public-config data:", publicData);
      console.log("public-config error:", publicError);
      console.log("FRONTEND_META_APP_ID:", FRONTEND_META_APP_ID || "(vazio)");
      console.log("FRONTEND_META_CONFIG_ID:", FRONTEND_META_CONFIG_ID || "(vazio)");
      console.groupEnd();

      const appId = FRONTEND_META_APP_ID || (publicData as any)?.appId || "";
      const configId = FRONTEND_META_CONFIG_ID || (publicData as any)?.configId || "";
      const missing: string[] = [];

      if (!appId) missing.push("VITE_META_APP_ID / META_APP_ID");
      if (!configId) missing.push("VITE_META_CONFIG_ID");
      if (!(statusData as any)?.hasMetaAppSecret) missing.push("META_APP_SECRET");

      return {
        appId,
        configId,
        hasFrontendAppId: Boolean(FRONTEND_META_APP_ID),
        hasFrontendConfigId: Boolean(FRONTEND_META_CONFIG_ID),
        hasBackendAppId: Boolean((statusData as any)?.hasMetaAppId),
        hasBackendConfigId: Boolean((statusData as any)?.hasMetaConfigId),
        hasMetaAppSecret: Boolean((statusData as any)?.hasMetaAppSecret),
        ready: Boolean(appId && configId && (statusData as any)?.hasMetaAppSecret && !publicError),
        missing,
        error: publicError,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // ── Embedded Signup — primary flow ────────────────────
  const connectViaEmbeddedSignup = useMutation({
    mutationFn: async (input: {
      code: string;
      wabaId?: string;
      phoneNumberId?: string;
    }) => {
      console.log("🚀 [WhatsApp] Embedded Signup — enviando code para backend...", {
        codeLength: input.code?.length,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
      });

      // invokeEdgeFunction handles both HTTP and logical errors
      const result = await invokeEdgeFunction("whatsapp-connect", {
        code: input.code,
        wabaId: input.wabaId || null,
        phoneNumberId: input.phoneNumberId || null,
      });

      console.log("✅ [WhatsApp] Resposta do backend:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_connection"] });
      toast.success("WhatsApp Business conectado com sucesso!");
    },
    onError: (e) => {
      console.error("❌ [WhatsApp] Erro na conexão:", e.message);
      toast.error("Erro ao conectar: " + e.message);
    },
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
    metaConfig: metaConfig.data ?? null,
    isMetaConfigLoading: metaConfig.isLoading,
    refetchMetaConfig: metaConfig.refetch,
    connectViaEmbeddedSignup,
    connectManual,
    disconnect,
    reconnect,
    testSend,
    saveTemplate,
    deleteTemplate,
  };
}
