import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Clock, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { conversations } from "@/lib/mock-data";

export const Route = createFileRoute("/demandas")({
  head: () => ({
    meta: [
      { title: "Demandas · ScrapperBot" },
      { name: "description", content: "Tudo o que os clientes pediram — resolva quando concluído." },
    ],
  }),
  component: DemandasPage,
});

type Status = "abertas" | "atrasadas" | "resolvidas";

interface Demand {
  id: string;
  chatId: string;
  chatName: string;
  sender: string;
  summary: string;
  when: string;
  teamReplied: boolean;
  status: Status;
}

const demandas: Demand[] = [
  { id: "d1", chatId: "c2", chatName: "Mariana Alves", sender: "Mariana", summary: "Quer retorno sobre cancelamento do contrato", when: "há 32min", teamReplied: false, status: "atrasadas" },
  { id: "d2", chatId: "c4", chatName: "João Pedro – Atacadão BR", sender: "João", summary: "Solicita desconto para 500 unidades", when: "há 2h", teamReplied: true, status: "abertas" },
  { id: "d3", chatId: "c7", chatName: "Construtora Vega", sender: "Ricardo", summary: "Reenvio de boleto vencido", when: "há 8h", teamReplied: false, status: "abertas" },
  { id: "d4", chatId: "c1", chatName: "Operação Norte", sender: "Lucas", summary: "Confirmar cronograma de entrega de sexta", when: "ontem", teamReplied: true, status: "resolvidas" },
  { id: "d5", chatId: "c6", chatName: "Suporte N2", sender: "Sistema", summary: "Postmortem do incidente #4421", when: "há 5h", teamReplied: false, status: "atrasadas" },
  { id: "d6", chatId: "c8", chatName: "RH Acme", sender: "Beatriz", summary: "Proposta comercial de parceria de treinamento", when: "ontem", teamReplied: true, status: "abertas" },
];

const tabs: { key: Status | "todas"; label: string }[] = [
  { key: "abertas", label: "Pendentes" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "resolvidas", label: "Resolvidas" },
  { key: "todas", label: "Todas" },
];

function DemandasPage() {
  const [tab, setTab] = useState<Status | "todas">("abertas");
  const visible = demandas.filter((d) => tab === "todas" || d.status === tab);

  const counts = {
    pendentes: demandas.filter((d) => d.status === "abertas").length,
    atrasadas: demandas.filter((d) => d.status === "atrasadas").length,
    resolvidas: demandas.filter((d) => d.status === "resolvidas").length,
    total: demandas.length,
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Operação</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Demandas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo o que clientes pediram — resolva manualmente quando concluído
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardSmall label="Pendentes" value={counts.pendentes} accent="bg-primary/15 text-primary" icon={<Clock className="h-4 w-4" />} />
        <KpiCardSmall label="Atrasadas (+4h)" value={counts.atrasadas} accent="bg-destructive/15 text-destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCardSmall label="Resolvidas" value={counts.resolvidas} accent="bg-emerald-500/15 text-emerald-400" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCardSmall label="Total" value={counts.total} accent="bg-muted text-foreground" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (tab === t.key
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[1.4fr_1fr_2fr_120px_140px_180px] gap-4 border-b border-border/60 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div>Cliente</div><div>Quem</div><div>Demanda</div><div>Quando</div><div>Status</div><div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/60">
            {visible.map((d) => (
              <div key={d.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_2fr_120px_140px_180px] gap-4 items-center px-5 py-4">
                <p className="text-sm font-semibold">{d.chatName}</p>
                <p className="text-sm text-muted-foreground">{d.sender}</p>
                <p className="text-sm">{d.summary}</p>
                <p className="text-xs text-muted-foreground">{d.when}</p>
                <div>
                  {d.status === "atrasadas" && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Atrasada</span>}
                  {d.status === "abertas" && (
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      {d.teamReplied ? "Aguardando confirmação" : "Aberta"}
                    </span>
                  )}
                  {d.status === "resolvidas" && <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">Resolvida</span>}
                </div>
                <div className="flex justify-end gap-1">
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to="/chat-ia" search={{ chatId: d.chatId }}><Sparkles className="h-3.5 w-3.5" /> IA</Link>
                  </Button>
                  {d.status !== "resolvidas" && (
                    <Button size="sm" variant="ghost" className="gap-1 text-emerald-400 hover:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {visible.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma demanda nesta visão.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCardSmall({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={"grid h-9 w-9 place-items-center rounded-lg " + accent}>{icon}</div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}