import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ClientLogoUpload({ value, onChange }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem (PNG/JPG)");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter até 2MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/client-logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("client-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("client-files").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Logo enviada");
    } catch (e: any) {
      toast.error("Erro ao enviar logo: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label>Logo do cliente</Label>
      <div className="flex items-center gap-3 mt-1">
        <div className="h-16 w-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                {value ? "Trocar logo" : "Enviar logo"}
              </span>
            </Button>
          </label>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG até 2MB. Aparece nos PDFs de orçamento e contrato.</p>
    </div>
  );
}