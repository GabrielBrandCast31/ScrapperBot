import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, MoreVertical, MessageSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";

export const Route = createFileRoute("/conversas/$id")({
  head: () => ({
    meta: [
      { title: `Conversa · ScrapperBot` },
      { name: "description", content: "Mensagens armazenadas da conversa." },
    ],
  }),
  component: ConversaDetail,
});

type Mensagem = {
  message_id: string;
  chat_id: string;
  chat_name: string | null;
  sender_id: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  body: string;
  from_me: number;
  msg_type: string | null;
  timestamp: number | null;
  quando: string | null;
};

type DetalheData = {
  chat_id: string;
  chat_name: string;
  mensagens: Mensagem[];
  total: number;
};

type ResumoAuditoria = {
  chat_id: string;
  chat_name: string | null;
  resumo: string;
  qtd_msgs: number;
  fim_ts: number;
  quando: string | null;
  janela: string | null;
};

function avatarLetters(name: string | null) {
  if (!name) return "??";
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ConversaDetail() {
  const { id: chatId } = Route.useParams();

  const detalhe = useQuery<DetalheData>({
    queryKey: ["conversa", chatId],
    queryFn: () => apiGet<DetalheData>(`/conversas/${encodeURIComponent(chatId)}`),
  });

  const auditoria = useQuery<{ sumarios: ResumoAuditoria[] }>({
    queryKey: ["auditoria"],
    queryFn: () => apiGet<{ sumarios: ResumoAuditoria[] }>("/auditoria"),
    staleTime: 60000,
  });
  const ultimoResumo = auditoria.data?.sumarios?.find((s) => s.chat_id === chatId);

  const c = detalhe.data;
  const mensagensAsc = c ? [...c.mensagens].reverse() : [];

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[auto_1fr] xl:grid-cols-[1fr_380px] xl:grid-rows-1">
      <div className="flex h-full min-h-0 flex-col border-r border-border/60">
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link to="/conversas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
            {avatarLetters(c?.chat_name ?? null)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {detalhe.isLoading ? "Carregando…" : (c?.chat_name || chatId)}
            </h2>
            <p className="text-xs text-muted-foreground">{c ? `${c.total} mensagens carregadas` : ""}</p>
          </div>
          <Button asChild size="sm" className="gap-1">
            <Link to="/chat-ia" search={{ chatId }}>
              <Sparkles className="h-3.5 w-3.5" /> Analisar com IA
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mais"><MoreVertical className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,oklch(1_0_0/0.03)_1px,transparent_0)] [background-size:18px_18px] px-5 py-5">
          <div className="mx-auto max-w-2xl space-y-3">
            {detalhe.isLoading && (
              <p className="text-center text-sm text-muted-foreground py-8">Carregando mensagens…</p>
            )}
            {!detalhe.isLoading && mensagensAsc.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
                <p>Nenhuma mensagem nessa conversa.</p>
              </div>
            )}
            {mensagensAsc.map((m) => {
              const isTeam = m.from_me === 1;
              return (
                <div key={m.message_id} className={isTeam ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[80%] space-y-1">
                    <div
                      className={
                        "rounded-2xl px-4 py-2.5 text-sm shadow-sm " +
                        (isTeam
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border rounded-bl-sm")
                      }
                    >
                      {!isTeam && m.sender_name && (
                        <p className="text-[11px] font-medium opacity-70">{m.sender_name}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.quando && (
                        <p className={"mt-1 text-[10px] " + (isTeam ? "opacity-80" : "text-muted-foreground")}>
                          {m.quando}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 p-3 text-center text-xs text-muted-foreground">
          Sistema observe-only — envio de mensagens não é suportado pelo painel.
        </div>
      </div>

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
              <CardTitle className="text-sm">Resumo</CardTitle>
              <CardDescription className="text-xs">
                {ultimoResumo.quando} · {ultimoResumo.qtd_msgs} msg analisadas
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {ultimoResumo.resumo}
              </p>
              {ultimoResumo.janela && (
                <p className="mt-3 text-[11px] text-muted-foreground">Janela: {ultimoResumo.janela}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Nenhum resumo da Auditoria IA gerado pra essa conversa ainda. A auditoria roda automaticamente a cada 1h (3h à noite).
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Faça uma pergunta sobre essa conversa
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Abre o Chat IA já com o transcript completo dessa conversa em contexto.
            </p>
            <Button asChild size="sm" className="mt-3 w-full gap-1">
              <Link to="/chat-ia" search={{ chatId }}>
                <Sparkles className="h-3.5 w-3.5" /> Abrir Chat IA
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
