import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/publicApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Proposal = {
  budget: { id: string; title: string; description: string | null; total_amount: number; valid_until: string | null; status: string; accepted_at: string | null; accepted_by_name: string | null };
  items: Array<{ id: string; title: string; description: string | null; quantity: number; unit_price: number; subtotal: number }>;
  client: { name: string } | null;
};

export default function PropostaPublica() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = () => publicApi.getProposal(slug).then((d) => setData(d as Proposal)).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, [slug]);

  const accept = async () => {
    if (!name) return toast.error("Informe seu nome");
    try {
      await publicApi.acceptProposal(slug, { accepted_by_name: name });
      toast.success("Proposta aceita!");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;

  const accepted = !!data.budget.accepted_at;

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-3xl mx-auto px-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Proposta</p>
                <CardTitle className="text-2xl">{data.budget.title}</CardTitle>
                {data.client && <p className="text-sm text-muted-foreground mt-1">Para: {data.client.name}</p>}
              </div>
              {accepted && <Badge>Aceita</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.budget.description && <p className="text-sm whitespace-pre-wrap">{data.budget.description}</p>}
            <div className="border rounded-lg divide-y">
              {data.items.map((it) => (
                <div key={it.id} className="flex justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    {it.description && <p className="text-muted-foreground text-xs">{it.description}</p>}
                    <p className="text-xs text-muted-foreground">{it.quantity} × R$ {Number(it.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <p className="font-medium">R$ {Number(it.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span>Total</span>
              <span>R$ {Number(data.budget.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            {data.budget.valid_until && (
              <p className="text-xs text-muted-foreground">Válida até {new Date(data.budget.valid_until).toLocaleDateString("pt-BR")}</p>
            )}
          </CardContent>
        </Card>

        {!accepted ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Aceitar proposta</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Seu nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="flex gap-2">
                <Button onClick={accept} className="flex-1">Aceitar proposta</Button>
              </div>
              <p className="text-xs text-muted-foreground">Após aceitar, você receberá os dados de pagamento.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aceita por <span className="font-medium text-foreground">{data.budget.accepted_by_name}</span> em {new Date(data.budget.accepted_at!).toLocaleString("pt-BR")}.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}