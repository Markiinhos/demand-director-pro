import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/publicApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Field = { id: string; label: string; type: "text" | "textarea" | "select"; required?: boolean; options?: string[] };
type Brief = { id: string; title: string; description: string | null; schema: Field[] };

export default function BriefingPublico() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    publicApi.getBriefing(token).then((d) => setData(d as Brief)).catch((e) => setError((e as Error).message));
  }, [token]);

  const submit = async () => {
    try {
      const missing = (data?.schema ?? []).filter((f) => f.required && !answers[f.id]);
      if (missing.length) return toast.error(`Preencha: ${missing.map((m) => m.label).join(", ")}`);
      await publicApi.submitBriefing(token, { answers, respondent_name: name, respondent_email: email });
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full"><CardContent className="py-10 text-center space-y-2">
        <h1 className="text-xl font-semibold">Obrigado!</h1>
        <p className="text-muted-foreground">Recebemos seu briefing.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-2xl mx-auto px-6">
        <Card>
          <CardHeader>
            <CardTitle>{data.title}</CardTitle>
            {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Seu nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            {(data.schema ?? []).map((f) => (
              <div key={f.id}>
                <Label>{f.label}{f.required && " *"}</Label>
                {f.type === "text" && <Input value={answers[f.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} />}
                {f.type === "textarea" && <Textarea rows={4} value={answers[f.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} />}
                {f.type === "select" && (
                  <Select value={answers[f.id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
            <Button onClick={submit} className="w-full">Enviar briefing</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}