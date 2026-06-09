import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, FileText, ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPostForm } from "@/lib/api/client";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar conversa · ScrapperBot" },
      { name: "description", content: "Importe um .txt do WhatsApp criando um cliente novo." },
    ],
  }),
  component: ImportarPage,
});

type ImportResult = {
  chat_id: string;
  chat_name: string;
  novas: number;
  total_linhas: number;
  puladas_sistema: number;
  puladas_vazias: number;
};

function ImportarPage() {
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const importar = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo .txt");
      const fd = new FormData();
      fd.append("arquivo", file);
      fd.append("chat_name", nome.trim());
      return apiPostForm<ImportResult>("/importar-arquivo", fd);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !nome.trim()) return;
    importar.mutate();
  };

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
        <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Importação</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Importar conversa (.txt)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie um cliente novo a partir de um .txt exportado do WhatsApp. Para adicionar mensagens a uma conversa <strong>já existente</strong>, use o botão "Sincronizar" na linha do cliente em <Link to="/conversas" className="underline">Conversas</Link>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo cliente</CardTitle>
          <CardDescription>
            No WhatsApp: <em>Conversa → ⋮ → Mais → Exportar conversa → Sem mídia</em>. Mensagens duplicadas são ignoradas via hash.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nome do cliente
              </label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: MARKETING ACME"
                className="mt-1"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Vira o chat_name no banco. O chat_id é gerado automaticamente como{" "}
                <code className="text-foreground">import:slug@g.us</code>.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Arquivo .txt
              </label>
              <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 hover:border-primary/40">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file ? file.name : "Clique para selecionar"}</p>
                  <p className="text-xs text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Aceita .txt do WhatsApp"}
                  </p>
                </div>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button type="submit" disabled={!file || !nome.trim() || importar.isPending} className="gap-2 w-full">
              {importar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importar.isPending ? "Importando…" : "Importar conversa"}
            </Button>
          </form>

          {importar.isSuccess && importar.data && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {importar.data.chat_name} — {importar.data.novas} mensagem(ns) importada(s).
                </p>
                <p className="text-xs text-muted-foreground">
                  {importar.data.total_linhas} linhas processadas, {importar.data.puladas_sistema} sistema, {importar.data.puladas_vazias} vazias.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  chat_id: <code>{importar.data.chat_id}</code>
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/conversas/$id" params={{ id: importar.data.chat_id }}>Ver</Link>
              </Button>
            </div>
          )}

          {importar.isError && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <p className="text-sm">Erro: {(importar.error as Error).message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
