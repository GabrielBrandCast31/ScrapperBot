import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ShieldCheck, Eye, AlertTriangle, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/client";

interface Sumario {
  id: string | number;
  chat_id: string;
  chat_name: string;
  resumo: string;
  qtd_msgs: number;
  inicio_ts: number;
  fim_ts: number;
  quando: string;
  janela: string;
}

interface AuditoriaData {
  sumarios: Sumario[];
}

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria IA · BrandCast" },
      { name: "description", content: "Resumos das conversas gerados pela IA." },
    ],
  }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<AuditoriaData>("/auditoria"),
    refetchInterval: 30_000,
  });

  const rodar = useMutation({
    mutationFn: () => apiPost<unknown>("/auditoria/rodar"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditoria"] }),
  });

  const sumarios = data?.sumarios ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Auditoria contínua</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Auditoria IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumos automáticos das janelas de conversa · atualiza a cada 30s
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => rodar.mutate()}
          disabled={rodar.isPending}
        >
          {rodar.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {rodar.isPending ? "Rodando…" : "Rodar nova auditoria"}
        </Button>
      </div>

      {rodar.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Falha ao rodar auditoria: {(rodar.error as Error)?.message}
        </div>
      )}
      {rodar.isSuccess && !rodar.isPending && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          ✅ Auditoria disparada. Os novos resumos aparecem aqui em instantes.
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Falha ao carregar resumos: {(error as Error)?.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sumarios.map((s) => (
          <Card key={s.id} className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base truncate">{s.chat_name}</CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.quando}</p>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums flex-shrink-0">
                  {s.qtd_msgs} msgs
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6 flex-1">
                {s.resumo}
              </p>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                <p className="text-[11px] text-muted-foreground truncate">{s.janela}</p>
                <div className="flex gap-1 flex-shrink-0">
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link to="/conversas/$id" params={{ id: s.chat_id }}>
                      <Eye className="h-3.5 w-3.5" /> Ver msgs
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="gap-1">
                    <Link to="/chat-ia" search={{ chatId: s.chat_id }}>
                      <Sparkles className="h-3.5 w-3.5" /> IA
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && sumarios.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <AlertTriangle className="h-8 w-8" />
          <p>Nenhuma auditoria ainda. Clique em <strong>Rodar nova auditoria</strong> pra começar.</p>
        </div>
      )}

      <Card className="border-primary/20 bg-card/50">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-sm space-y-1">
            <p className="font-semibold">Como funciona</p>
            <p className="text-muted-foreground">
              A IA percorre as conversas em janelas de tempo e gera um resumo curto de cada bloco — tom do cliente,
              promessas trocadas, pontos de atenção. Tudo é <em>observe-only</em>: nada é enviado pelo agente.
              Use o botão acima pra disparar uma nova varredura sob demanda.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
