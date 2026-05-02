import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

function slugify() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36)).join("").slice(0, 12);
}

export function PublicProposalButton({ budgetId, currentSlug }: { budgetId: string; currentSlug: string | null }) {
  const [slug, setSlug] = useState(currentSlug);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const newSlug = slug ?? slugify();
    if (!slug) {
      const { error } = await supabase.from("budgets").update({ public_slug: newSlug, status: "enviado" }).eq("id", budgetId);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setSlug(newSlug);
    }
    const url = `${window.location.origin}/proposta/${newSlug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado: " + url);
    setLoading(false);
  };

  return (
    <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
      {slug ? <Copy className="h-3 w-3 mr-1" /> : <Link2 className="h-3 w-3 mr-1" />}
      {slug ? "Copiar link público" : "Gerar link público"}
    </Button>
  );
}