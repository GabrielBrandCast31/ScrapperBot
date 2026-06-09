import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Eye, MessageSquare, Clock, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { apiGet } from "@/lib/api/client";

interface TopConversa {
  chat_id: string;
  chat_name: string;
  total: number;
  last_ts: number;
  ultima: string;
  last_ts_fmt: string;
}

interface InsightsData {
  mensagens_total: number;
  mensagens_24h: number;
  clientes_total: number;
  top_conversas: TopConversa[];
}

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights · BrandCast" },
      { name: "description", content: "Panorama das conversas monitoradas." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["insights"],
    queryFn: () => apiGet<InsightsData>("/insights"),
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Panorama</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Panorama das conversas armazenadas</p>
        </div>
        <span className="text-xs text-muted-foreground">Atualiza a cada 60s</span>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Falha ao carregar insights: {(error as Error)?.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Mensagens armazenadas"
          value={isLoading ? "—" : (data?.mensagens_total ?? 0).toLocaleString("pt-BR")}
          icon={MessageSquare}
          accent="primary"
        />
        <KpiCard
          label="Mensagens últimas 24h"
          value={isLoading ? "—" : (data?.mensagens_24h ?? 0).toLocaleString("pt-BR")}
          icon={Clock}
          accent="info"
        />
        <KpiCard
          label="Clientes monitorados"
          value={isLoading ? "—" : (data?.clientes_total ?? 0).toLocaleString("pt-BR")}
          icon={Users}
          accent="warning"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversas mais ativas</CardTitle>
          <CardDescription>Top {data?.top_conversas?.length ?? 0} por volume de mensagens</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_220px] gap-4 border-b border-border/60 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div>Conversa</div>
            <div className="text-right">Mensagens</div>
            <div className="text-right">Última</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/60">
            {(data?.top_conversas ?? []).map((c) => (
              <div
                key={c.chat_id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_220px] gap-4 items-center px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.chat_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.ultima}</p>
                </div>
                <p className="text-right text-sm font-semibold tabular-nums">
                  {c.total.toLocaleString("pt-BR")}
                </p>
                <p className="text-right text-xs text-muted-foreground">{c.last_ts_fmt}</p>
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link to="/conversas/$id" params={{ id: c.chat_id }}>
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="gap-1">
                    <Link to="/chat-ia" search={{ chatId: c.chat_id }}>
                      <Sparkles className="h-3.5 w-3.5" /> Analisar com IA
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && (data?.top_conversas?.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhuma conversa monitorada ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
