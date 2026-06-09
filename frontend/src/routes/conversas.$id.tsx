import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, MessageSquare, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";

interface Mensagem {
  message_id: string | number;
  body: string;
  from_me: number | boolean;
  sender_name?: string | null;
  quando: string;
}

interface ConversaDetalhe {
  chat_id: string;
  chat_name: string;
  mensagens: Mensagem[];
  total: number;
}

interface Sumario {
  id: string | number;
  chat_id: string;
  chat_name: string;
  resumo: string;
  qtd_msgs: number;
  quando: string;
  janela: string;
}

interface AuditoriaData {
  sumarios: Sumario[];
}

export const Route = createFileRoute("/conversas/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Conversa ${params.id} · BrandCast` },
      { name: "description", content: "Detalhe das mensagens monitoradas." },
    ],
  }),
  component: ConversaDetail,
});

function ConversaDetail() {
  const { id } = Route.useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["conversa", id],
    queryFn: () => apiGet<ConversaDetalhe>(`/conversas/${encodeURIComponent(id)}?limit=500`),
    refetchInterval: 30_000,
  });

  const auditoria = useQuery({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<AuditoriaData>("/auditoria"),
    refetchInterval: 60_000,
  });

  const ultimoResumo = (auditoria.data?.sumarios ?? []).find((s) => s.chat_id === id);

  const mensagens = data?.mensagens ?? [];
  const chatName = data?.chat_name ?? id;

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[auto_1fr] xl:grid-cols-[1fr_380px] xl:grid-rows-1">
      {/* Chat column */}
      <div className="flex h-full min-h-0 flex-col border-r border-border/60">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link to="/conversas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
            {iniciais(chatName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-sm font-semibold">{chatName}</h2>
            <p className="text-xs text-muted-foreground">
              {(data?.total ?? mensagens.length).toLocaleString("pt-BR")} mensagens armazenadas
            </p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,oklch(1_0_0/0.03)_1px,transparent_0)] [background-size:18px_18px] px-5 py-5">
          <div className="mx-auto max-w-2xl space-y-3">
            {isLoading && (
              <p className="text-center text-sm text-muted-foreground py-10">Carregando mensagens…</p>
            )}
            {isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Falha ao carregar conversa: {(error as Error)?.message}
              </div>
            )}
            {mensagens.map((m) => {
              const fromMe = !!m.from_me;
              return (
                <div key={m.message_id} className={fromMe ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[80%]">
                    <div
                      className={
                        "rounded-2xl px-4 py-2 text-sm shadow-sm " +
                        (fromMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm")
                      }
                    >
                      {!fromMe && m.sender_name && (
                        <p className="text-[11px] font-medium opacity-70 mb-0.5">{m.sender_name}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={"mt-1 text-[10px] " + (fromMe ? "opacity-80" : "text-muted-foreground")}>
                        {m.quando}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!isLoading && mensagens.length === 0 && !isError && (
              <p className="text-center text-sm text-muted-foreground py-10">
                Nenhuma mensagem armazenada para essa conversa.
              </p>
            )}
          </div>
        </div>

        {/* Footer observe-only */}
        <div className="border-t border-border/60 px-5 py-3 text-center text-xs text-muted-foreground">
          observe-only — envio de mensagens não é suportado pelo monitor.
        </div>
      </div>

      {/* Sidebar — Auditoria IA */}
      <aside className="overflow-y-auto p-5 space-y-4 bg-card/30">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Auditoria IA</p>
            <p className="text-sm font-semibold">Último resumo</p>
          </div>
        </div>

        {ultimoResumo ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{ultimoResumo.quando}</CardTitle>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                  {ultimoResumo.qtd_msgs} msgs
                </span>
              </div>
              <CardDescription className="text-xs">{ultimoResumo.janela}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ultimoResumo.resumo}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p>Sem auditoria IA registrada pra esta conversa ainda.</p>
                <p className="mt-1 text-xs">
                  Rode uma nova auditoria na aba <Link to="/auditoria" className="text-primary underline">Auditoria IA</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Button asChild className="w-full gap-2">
          <Link to="/chat-ia" search={{ chatId: id }}>
            <Sparkles className="h-4 w-4" /> Abrir Chat IA
          </Link>
        </Button>

        <Button asChild variant="outline" className="w-full gap-2">
          <Link to="/conversas">
            <MessageSquare className="h-4 w-4" /> Voltar pra lista
          </Link>
        </Button>
      </aside>
    </div>
  );
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
