import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import mammoth from "mammoth";
import { jsPDF } from "jspdf";
import { urlToDataUrl, detectImageFormat } from "@/lib/imageToDataUrl";
import { getSignedFileUrl } from "@/lib/storage";

function extractPlaceholders(text: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return Array.from(set);
}

function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function useContractTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["contract_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upload = useMutation({
    mutationFn: async ({ file, name, description }: { file: File; name: string; description?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
      if (!["docx", "txt"].includes(ext)) throw new Error("Use .docx ou .txt");

      // Extrair texto + placeholders
      let raw = "";
      if (ext === "docx") {
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        raw = result.value;
      } else {
        raw = await file.text();
      }
      const placeholders = extractPlaceholders(raw);

      const path = `${user.id}/contract-templates/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("client-files").upload(path, file);
      if (upErr) throw upErr;

      const { data, error } = await supabase.from("contract_templates").insert({
        user_id: user.id,
        name,
        description: description ?? null,
        file_url: path,
        file_name: file.name,
        file_type: ext,
        placeholders,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_templates"] });
      toast.success("Modelo enviado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_templates"] }),
  });

  return { templates: list.data ?? [], isLoading: list.isLoading, upload, remove };
}

export function useContracts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, clients(name), contract_templates(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const generate = useMutation({
    mutationFn: async (input: { template_id: string; client_id: string; title: string; variables: Record<string, string>; budget_id?: string | null; include_logo?: boolean }) => {
      if (!user) throw new Error("Não autenticado");
      const { data: tpl, error: tErr } = await supabase.from("contract_templates").select("*").eq("id", input.template_id).single();
      if (tErr) throw tErr;

      // Buscar logo do cliente (opcional)
      let logoDataUrl: string | null = null;
      if (input.include_logo) {
        const { data: client } = await supabase.from("clients").select("logo_url").eq("id", input.client_id).single();
        const stored = (client as any)?.logo_url as string | undefined;
        const signed = stored ? await getSignedFileUrl(stored) : null;
        if (signed) logoDataUrl = await urlToDataUrl(signed);
      }

      // Carregar texto do modelo
      const tplUrl = await getSignedFileUrl(tpl.file_url);
      if (!tplUrl) throw new Error("Não foi possível acessar o modelo");
      const fileResp = await fetch(tplUrl);
      const buf = await fileResp.arrayBuffer();
      let raw = "";
      if (tpl.file_type === "docx") {
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        raw = result.value;
      } else {
        raw = new TextDecoder().decode(buf);
      }
      const filled = fillPlaceholders(raw, input.variables);

      // Gerar PDF
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const lineHeight = 6;
      const margin = 20;
      const maxWidth = 170;
      let y = margin;
      if (logoDataUrl) {
        try {
          const fmt = detectImageFormat(logoDataUrl);
          pdf.addImage(logoDataUrl, fmt, margin, y, 30, 18, undefined, "FAST");
          y += 22;
        } catch { /* ignore */ }
      }
      pdf.setFontSize(14);
      pdf.text(input.title, margin, y);
      y += 10;
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(filled, maxWidth);
      for (const line of lines) {
        if (y > 280) { pdf.addPage(); y = margin; }
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      const pdfBlob = pdf.output("blob");

      const path = `${user.id}/contracts/${Date.now()}-${input.title}.pdf`;
      const { error: upErr } = await supabase.storage.from("client-files").upload(path, pdfBlob, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data, error } = await supabase.from("contracts").insert({
        user_id: user.id,
        client_id: input.client_id,
        template_id: input.template_id,
        budget_id: input.budget_id ?? null,
        title: input.title,
        variables: input.variables,
        generated_pdf_url: path,
        status: "draft",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato gerado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });

  return { contracts: list.data ?? [], isLoading: list.isLoading, generate, remove };
}