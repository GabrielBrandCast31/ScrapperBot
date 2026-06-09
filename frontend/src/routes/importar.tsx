import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPostForm } from "@/lib/api/client";

interface ImportResult {
  chat_id: string;
  chat_name: string;
  novas: number;
  total_linhas: number;
  puladas_sistema: number;
  puladas_vazias: number;
}

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar conversa · BrandCast" },
      { name: "description", content: "Importe um .txt exportado do WhatsApp para o monitor." },
    ],
  }),
  component: ImportarPage,
});

function ImportarPage() {
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { nome: string; file: File }) => {
      const fd = new FormData();
      fd.append("arquivo", payload.file);
      fd.append("chat_name", payload.nome);
      return apiPostForm<ImportResult>("/importar-arquivo", fd);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !nome.trim()) return;
    mutation.mutate({ nome: nome.trim(), file });
  };

  const result = mutation.data;

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
        <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Importação</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Importar conversa (.txt)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie um arquivo exportado do WhatsApp para incluir no monitor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo arquivo</CardTitle>
          <CardDescription>
            No WhatsApp: <em>Conversa → Mais → Exportar conversa → Sem mídia</em>. Mensagens duplicadas são ignoradas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome do cliente / conversa</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Cliente Acme - Comercial"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Arquivo .txt</label>
              <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 hover:border-primary/40">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file ? file.name : "Clique para selecionar"}</p>
                  <p className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Aceita .txt do WhatsApp"}</p>
                </div>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button type="submit" disabled={!file || !nome.trim() || mutation.isPending} className="gap-2 w-full">
              <Upload className="h-4 w-4" /> {mutation.isPending ? "Importando…" : "Importar conversa"}
            </Button>
          </form>

          {result && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{result.chat_name} — {result.novas} mensagem(ns) nova(s) de {result.total_linhas} linha(s).</p>
                <p className="text-xs text-muted-foreground">
                  Já está no banco e pode ser consultada pela IA.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/conversas/$id" params={{ id: result.chat_id }}>Ver</Link>
              </Button>
            </div>
          )}

          {mutation.isError && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Falha ao importar.</p>
                <p className="text-xs text-muted-foreground">
                  {(mutation.error as Error)?.message ?? "Erro desconhecido."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
