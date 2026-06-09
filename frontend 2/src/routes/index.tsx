import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  Smartphone,
  ShieldCheck,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { apiGet } from "@/lib/api/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral · ScrapperBot" },
      { name: "description", content: "Painel de monitoramento de atendimento BrandCast." },
    ],
  }),
  component: Index,
});

type TopConversa = {
  chat_id: string;
  chat_name: string | null;
  total: number;
  ultima: string | null;
};

type InsightsData = {
  mensagens_total: number;
  mensagens_24h: number;
  clientes_total: number;
  top_conversas: TopConversa[];
};

type Sumario = {
  id: number;
  chat_id: string;
  chat_name: string | null;
  resumo: string;
  qtd_msgs: number;
  quando: string | null;
};

type SessionInfo = {
  status: string | null;
  me: { id?: string; pushName?: string } | null;
};

function Index() {
  const insights = useQuery<InsightsData>({
    queryKey: ["insights"],
    queryFn: () => apiGet<InsightsData>("/insights"),
    refetchInterval: 60000,
  });

  const auditoria = useQuery<{ sumarios: Sumario[] }>({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<{ sumarios: Sumario[] }>("/auditoria"),
    staleTime: 30000,
  });

  const conexao = useQuery<SessionInfo>({
    queryKey: ["conexao", "status"],
    queryFn: () => apiGet<SessionInfo>("/conexao/status"),
    refetchInterval: 10000,
  });

  const top = insights.data?.top_conversas ?? [];
  const ultimosResumos = (auditoria.data?.sumarios ?? []).slice(0, 6);
  const status = conexao.data?.status;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Painel BrandCast</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Visão Geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor de atendimento — conversas dos clientes WhatsApp, auditadas por IA.
        </p>
      </div>

      <Card
        className={
          status === "WORKING"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : status === "SCAN_QR_CODE"
              ? "border-amber-500/30 bg-amber-500/5"
              : status === "FAILED"
                ? "border-red-500/30 bg-red-500/5"
                : ""
        }
      >
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-card border">
            {status === "WORKING" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : status === "SCAN_QR_CODE" ? (
              <Smartphone className="h-5 w-5 text-amber-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {status === "WORKING" && "WhatsApp conectado e capturando em tempo real"}
              {status === "SCAN_QR_CODE" && "Aguardando pareamento do WhatsApp"}
              {status === "STARTING" && "Iniciando sessão WhatsApp…"}
              {status === "STOPPED" && "Sessão WhatsApp parada"}
              {status === "FAILED" && "Sessão WhatsApp falhou"}
              {!status && "Verificando conexão…"}
            </p>
            {conexao.data?.me?.id && (
              <p className="text-xs text-muted-foreground">
                {conexao.data.me.id.replace("@c.us", "")}
                {conexao.data.me.pushName && ` · ${conexao.data.me.pushName}`}
              </p>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link to="/conexao">Gerenciar conexão <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Mensagens armazenadas"
          value={insights.isLoading ? "…" : (insights.data?.mensagens_total ?? 0).toLocaleString("pt-BR")}
          icon={MessageSquare}
        />
        <KpiCard
          label="Mensagens últimas 24h"
          value={insights.isLoading ? "…" : (insights.data?.mensagens_24h ?? 0).toLocaleString("pt-BR")}
          icon={Clock}
          accent="info"
        />
        <KpiCard
          label="Clientes monitorados"
          value={insights.isLoading ? "…" : (insights.data?.clientes_total ?? 0).toString()}
          icon={Users}
          accent="warning"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Conversas mais ativas</CardTitle>
              <CardDescription>Últimas a receber mensagem</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost" className="gap-1">
              <Link to="/conversas">Ver todas <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {top.length === 0 && !insights.isLoading && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sem conversas ainda.</p>
            )}
            <div className="divide-y divide-border/60">
              {top.slice(0, 6).map((c) => (
                <div key={c.chat_id} className="grid grid-cols-[1fr_80px_80px_60px] gap-3 items-center px-5 py-3">
                  <p className="truncate text-sm font-medium">{c.chat_name || c.chat_id}</p>
                  <p className="text-right text-sm font-semibold tabular-nums">{c.total.toLocaleString("pt-BR")}</p>
                  <p className="text-right text-xs text-muted-foreground">{c.ultima || "—"}</p>
                  <div className="flex justify-end">
                    <Button asChild variant="ghost" size="icon" title="Ver">
                      <Link to="/conversas/$id" params={{ id: c.chat_id }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auditoria IA recente
              </CardTitle>
              <CardDescription>Resumos gerados pela IA</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost" className="gap-1">
              <Link to="/auditoria">Ver todos <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {ultimosResumos.length === 0 && !auditoria.isLoading && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum resumo gerado ainda.</p>
            )}
            <div className="divide-y divide-border/60">
              {ultimosResumos.map((s) => (
                <Link
                  key={s.id}
                  to="/conversas/$id"
                  params={{ id: s.chat_id }}
                  className="block px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="truncate text-sm font-medium">{s.chat_name || s.chat_id}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{s.quando}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.resumo}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/chat-ia" className="rounded-lg border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
          <Sparkles className="h-5 w-5 text-primary mb-2" />
          <p className="font-medium text-sm">Chat IA</p>
          <p className="text-xs text-muted-foreground">Pergunte sobre suas conversas</p>
        </Link>
        <Link to="/conversas" className="rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors">
          <MessageSquare className="h-5 w-5 mb-2" />
          <p className="font-medium text-sm">Conversas</p>
          <p className="text-xs text-muted-foreground">Todas as conversas armazenadas</p>
        </Link>
        <Link to="/clientes" className="rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors">
          <Users className="h-5 w-5 mb-2" />
          <p className="font-medium text-sm">Clientes</p>
          <p className="text-xs text-muted-foreground">Grupos monitorados</p>
        </Link>
        <Link to="/auditoria" className="rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors">
          <ShieldCheck className="h-5 w-5 mb-2" />
          <p className="font-medium text-sm">Auditoria IA</p>
          <p className="text-xs text-muted-foreground">Resumos automáticos</p>
        </Link>
      </div>
    </div>
  );
}
