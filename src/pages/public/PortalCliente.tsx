import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/publicApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, MessageSquare, FileText, Download } from "lucide-react";

type PortalData = {
  client: { name: string; contact_name?: string | null } | null;
  demands: Array<{ id: string; title: string; description: string | null; status: string; due_date: string }>;
  versions: Array<{ id: string; demand_id: string; version_number: number; file_url: string | null; file_name: string | null; created_at: string }>;
  feedback: Array<{ id: string; demand_id: string; action: string; comment: string | null; author_name: string | null; created_at: string }>;
  budgets: Array<{ id: string; title: string; total_amount: number; status: string; public_slug: string | null; accepted_at: string | null }>;
  contracts: Array<{ id: string; title: string; status: string; generated_pdf_url: string | null }>;
};

export default function PortalCliente() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const d = await publicApi.getPortal(token) as PortalData;
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [token]);

  const sendFeedback = async (demand_id: string, action: "approved" | "changes_requested") => {
    const versionId = data?.versions.find((v) => v.demand_id === demand_id)?.id;
    try {
      await publicApi.sendFeedback(token, {
        demand_id,
        version_id: versionId,
        action,
        comment: comments[demand_id] ?? "",
        author_name: name || null,
      });
      toast.success(action === "approved" ? "Aprovado!" : "Ajuste solicitado");
      setComments((c) => ({ ...c, [demand_id]: "" }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error ?? "Erro"}</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Portal do Cliente</p>
          <h1 className="text-2xl font-semibold">Olá, {data.client?.contact_name || data.client?.name}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <section>
          <Input placeholder="Seu nome (para registrar suas aprovações)" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Demandas</h2>
          {data.demands.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma demanda ainda.</p>}
          {data.demands.map((d) => {
            const versions = data.versions.filter((v) => v.demand_id === d.id);
            const fb = data.feedback.filter((f) => f.demand_id === d.id);
            return (
              <Card key={d.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
                  </div>
                  <Badge variant={d.status === "finalizado" ? "default" : "secondary"}>{d.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {versions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Versões</p>
                      {versions.map((v) => (
                        <a key={v.id} href={v.file_url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Download className="h-4 w-4" /> V{v.version_number} — {v.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Textarea placeholder="Comentário (opcional)" value={comments[d.id] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [d.id]: e.target.value }))} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => sendFeedback(d.id, "approved")}><Check className="h-4 w-4 mr-1" /> Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => sendFeedback(d.id, "changes_requested")}><MessageSquare className="h-4 w-4 mr-1" /> Solicitar ajuste</Button>
                    </div>
                  </div>
                  {fb.length > 0 && (
                    <div className="space-y-1 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Histórico</p>
                      {fb.map((f) => (
                        <div key={f.id} className="text-xs text-muted-foreground">
                          <span className="font-medium">{f.action === "approved" ? "✓ Aprovado" : f.action === "changes_requested" ? "↻ Ajuste" : "Comentário"}</span>
                          {f.author_name && ` por ${f.author_name}`} — {new Date(f.created_at).toLocaleString()}
                          {f.comment && <div className="ml-2">"{f.comment}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {data.budgets.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Propostas</h2>
            {data.budgets.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{b.title}</p>
                    <p className="text-sm text-muted-foreground">R$ {Number(b.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  {b.public_slug ? (
                    <Button asChild size="sm" variant="outline"><a href={`/proposta/${b.public_slug}`} target="_blank" rel="noreferrer">Abrir proposta</a></Button>
                  ) : <Badge variant="secondary">{b.status}</Badge>}
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {data.contracts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contratos</h2>
            {data.contracts.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span>{c.title}</span></div>
                  {c.generated_pdf_url && <Button asChild size="sm" variant="outline"><a href={c.generated_pdf_url} target="_blank" rel="noreferrer">Baixar PDF</a></Button>}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}