import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Eye, Loader2, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/client";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria IA · ScrapperBot" },
      { name: "description", content: "Resumos automáticos das conversas ativas, gerados pela IA a cada 1h." },
    ],
  }),
  component: AuditoriaPage,
});

type Sumario = {
  id: number;
  chat_id: string;
  chat_name: string | null;
  inicio_ts: number;
  fim_ts: number;
  qtd_msgs: number;
  resumo: string;
  created_at: string;
  quando: string | null;
  janela: string | null;
};

function AuditoriaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ sumarios: Sumario[] }>({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<{ sumarios: Sumario[] }>("/auditoria"),
    refetchInterval: 30000,
  });

  const rodar = useMutation({
    mutationFn: () => apiPost<unknown>("/auditoria/rodar"),
    onSuccess: () => {
      // disparo em segundo plano — aguarda 30s e refaz
      setTimeout(() => qc.invalidateQueries({ queryKey: ["auditoria"] }), 30000);
    },
  });

  const sumarios = data?.sumarios ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Auditoria contínua</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Auditoria IA <span className="text-base font-normal text-muted-foreground">({sumarios.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumos automáticos das conversas ativas. Roda de 1h em 1h durante o dia e de 3h em 3h à noite.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => rodar.mutate()}
          disabled={rodar.isPending}
        >
          {rodar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Rodar nova auditoria
        </Button>
      </div>

      {rodar.isSuccess && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          ✅ Auditoria disparada em segundo plano. Os novos resumos aparecem em ~30-60s.
        </div>
      )}

      {isLoading && (
        <div className="py-16 text-center text-muted-foreground">Carregando resumos…</div>
      )}

      {!isLoading && sumarios.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ShieldCheck className="h-8 w-8" />
          <p>Nenhum resumo ainda. Clique em "Rodar nova auditoria" pra começar.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sumarios.map((s) => (
          <Card key={s.id} className="flex h-full flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm line-clamp-2">
                    {s.chat_name || s.chat_id}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {s.quando} · {s.qtd_msgs} msg analisadas
                  </CardDescription>
                </div>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  IA
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {s.resumo}
              </p>
              {s.janela && (
                <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                  Janela: {s.janela}
                </p>
              )}
              <div className="flex gap-1.5 pt-1">
                <Button asChild variant="ghost" size="sm" className="gap-1 flex-1">
                  <Link to="/conversas/$id" params={{ id: s.chat_id }}>
                    <Eye className="h-3.5 w-3.5" /> Ver msgs
                  </Link>
                </Button>
                <Button asChild size="sm" className="gap-1 flex-1">
                  <Link to="/chat-ia" search={{ chatId: s.chat_id }}>
                    <Sparkles className="h-3.5 w-3.5" /> IA
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Como funciona:</strong> a auditoria varre as conversas que receberam mensagem nas últimas 1h (ou 3h à noite, pra economizar tokens), monta um transcript de cada uma e pede pro <code>gpt-4o-mini</code> um resumo de 3-5 linhas (cliente pediu / equipe respondeu / o que ficou aberto). Resumo fica salvo aqui.
      </div>
    </div>
  );
}
