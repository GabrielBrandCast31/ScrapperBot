import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
} from "lucide-react";

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

interface Sumario {
  id: string | number;
  chat_id: string;
  chat_name: string;
  resumo: string;
  qtd_msgs: number;
  quando: string;
}

interface AuditoriaData {
  sumarios: Sumario[];
}

interface ConexaoStatus {
  status: string;
  me?: { id?: string; pushName?: string } | null;
  engine?: { engine?: string; WWebVersion?: string; state?: string } | null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral · BrandCast" },
      { name: "description", content: "Monitor de demandas de clientes via WhatsApp." },
    ],
  }),
  component: Index,
});

function bannerStyle(status: string) {
  if (status === "WORKING") {
    return {
      classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      icon: CheckCircle2,
      label: "Conectado",
      desc: "Sessão ativa. Mensagens estão sendo capturadas em tempo real.",
    };
  }
  if (status === "SCAN_QR_CODE" || status === "STARTING") {
    return {
      classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
      icon: AlertTriangle,
      label: status === "STARTING" ? "Iniciando" : "Aguardando QR",
      desc: "Vá em Conexão pra escanear o QR ou aguardar o motor terminar de subir.",
    };
  }
  return {
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: PowerOff,
    label: status === "STOPPED" ? "Desconectado" : status,
    desc: "Sessão não está capturando. Abra Conexão pra iniciar ou reconectar.",
  };
}

function Index() {
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => apiGet<InsightsData>("/insights"),
    refetchInterval: 60_000,
  });

  const auditoria = useQuery({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<AuditoriaData>("/auditoria"),
    refetchInterval: 60_000,
  });

  const conexao = useQuery({
    queryKey: ["conexao"],
    queryFn: () => apiGet<ConexaoStatus>("/conexao/status"),
    refetchInterval: 10_000,
  });

  const status = conexao.data?.status ?? "STOPPED";
  const banner = bannerStyle(status);
  const BannerIcon = banner.icon;

  const top = (insights.data?.top_conversas ?? []).slice(0, 6);
  const sumarios = (auditoria.data?.sumarios ?? []).slice(0, 6);

  return (
    <main className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <section className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Painel</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor observe-only · captura mensagens via WhatsApp e gera resumos com IA
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/chat-ia"><Sparkles className="h-4 w-4" /> Chat IA</Link>
        </Button>
      </section>

      {/* Banner de conexão */}
      <Card className={`border ${banner.classes}`}>
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/20">
            <BannerIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider">
              WhatsApp · {banner.label}
            </p>
            <p className="mt-1 text-sm text-foreground/90">
              {banner.desc}
              {conexao.data?.me?.pushName && status === "WORKING" && (
                <> · conectado como <strong>{conexao.data.me.pushName}</strong></>
              )}
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/conexao"><Smartphone className="h-4 w-4" /> Abrir Conexão</Link>
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Mensagens armazenadas"
          value={insights.isLoading ? "—" : (insights.data?.mensagens_total ?? 0).toLocaleString("pt-BR")}
          icon={MessageSquare}
          accent="primary"
        />
        <KpiCard
          label="Mensagens últimas 24h"
          value={insights.isLoading ? "—" : (insights.data?.mensagens_24h ?? 0).toLocaleString("pt-BR")}
          icon={Clock}
          accent="info"
        />
        <KpiCard
          label="Clientes monitorados"
          value={insights.isLoading ? "—" : (insights.data?.clientes_total ?? 0).toLocaleString("pt-BR")}
          icon={Users}
          accent="warning"
        />
      </section>

      {/* Conversas + Auditoria */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Conversas mais ativas</CardTitle>
              <CardDescription>Top {top.length} por volume</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/conversas">Ver todas <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {top.map((c) => (
                <Link
                  key={c.chat_id}
                  to="/conversas/$id"
                  params={{ id: c.chat_id }}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.chat_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.ultima}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {c.total.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{c.last_ts_fmt}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Link>
              ))}
              {!insights.isLoading && top.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Sem conversas ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Auditoria IA recente</CardTitle>
              <CardDescription>Últimos {sumarios.length} resumos</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/auditoria">Ver tudo <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {sumarios.map((s) => (
                <Link
                  key={s.id}
                  to="/conversas/$id"
                  params={{ id: s.chat_id }}
                  className="block px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{s.chat_name}</p>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{s.quando}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {s.resumo}
                  </p>
                </Link>
              ))}
              {!auditoria.isLoading && sumarios.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma auditoria ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Atalhos */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Shortcut to="/chat-ia" label="Chat IA" icon={Sparkles} desc="Conversar com a IA" />
        <Shortcut to="/conversas" label="Conversas" icon={MessageSquare} desc="Inbox completo" />
        <Shortcut to="/clientes" label="Clientes" icon={Users} desc="Cards por pessoa" />
        <Shortcut to="/auditoria" label="Auditoria IA" icon={ShieldCheck} desc="Resumos automáticos" />
      </section>
    </main>
  );
}

function Shortcut({
  to,
  label,
  icon: Icon,
  desc,
}: {
  to: string;
  label: string;
  icon: typeof Sparkles;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border/60 bg-card/50 p-4 hover:border-primary/40 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
