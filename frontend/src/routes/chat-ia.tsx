import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, Bot, User, Target, X, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api/client";

type ChatSearch = { chatId?: string };

interface ConversaDetalhe {
  chat_id: string;
  chat_name: string;
  total: number;
}

interface PerguntarReq {
  historia: { role: "user" | "assistant"; content: string }[];
  chat_id?: string;
}

interface PerguntarRes {
  resposta: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const globalSuggestions = [
  "Qual o panorama geral das conversas monitoradas?",
  "Quais clientes deram retorno nas últimas 24h?",
  "Tem alguma demanda pendente sem resposta?",
  "Resuma o que está acontecendo nesta semana",
];

const focusedSuggestions = [
  "Resume essa conversa",
  "Quais foram as últimas demandas trazidas pelo cliente?",
  "Tem algo pendente que ainda não foi respondido?",
  "Qual o tom dessa conversa nas últimas mensagens?",
];

export const Route = createFileRoute("/chat-ia")({
  head: () => ({
    meta: [
      { title: "Chat IA · BrandCast" },
      { name: "description", content: "Pergunte qualquer coisa sobre as conversas monitoradas." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    chatId: typeof s.chatId === "string" && s.chatId.length > 0 ? s.chatId : undefined,
  }),
  component: ChatIaPage,
});

function ChatIaPage() {
  const { chatId } = Route.useSearch();

  const focused = useQuery({
    queryKey: ["conversa-meta", chatId],
    queryFn: () => apiGet<ConversaDetalhe>(`/conversas/${encodeURIComponent(chatId!)}?limit=1`),
    enabled: !!chatId,
    staleTime: 60_000,
  });

  const focusedName = focused.data?.chat_name;

  const seed = useMemo<Msg[]>(() => {
    if (chatId && focusedName) {
      return [
        {
          role: "assistant",
          content: `Estou com a conversa de **${focusedName}** em contexto. Pergunte direto — posso resumir, listar demandas pendentes, analisar tom ou trechos específicos.`,
        },
      ];
    }
    if (chatId) {
      return [{ role: "assistant", content: "Carregando contexto da conversa…" }];
    }
    return [
      {
        role: "assistant",
        content:
          "Olá! Eu acompanho todas as conversas que o monitor capturou. Pergunte qualquer coisa — demandas pendentes, panorama por cliente, padrões. Pra focar em uma conversa específica, abra ela e clique em 'Analisar com IA'.",
      },
    ];
  }, [chatId, focusedName]);

  const [messages, setMessages] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // re-seed apenas quando o contexto (chatId) muda — preserva histórico
  const lastChatRef = useRef<string | undefined>(chatId);
  useEffect(() => {
    if (lastChatRef.current !== chatId) {
      lastChatRef.current = chatId;
      setMessages(seed);
    } else if (messages.length === 1 && messages[0].content.startsWith("Carregando")) {
      // atualiza a seed inicial assim que o nome resolve
      setMessages(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, focusedName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: async (history: Msg[]) => {
      const body: PerguntarReq = {
        historia: history.map((m) => ({ role: m.role, content: m.content })),
        chat_id: chatId,
      };
      return apiPost<PerguntarRes>("/chat-ia/perguntar", body);
    },
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.resposta }]);
    },
    onError: (err) => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `⚠️ Falha ao consultar a IA: ${(err as Error).message}`,
        },
      ]);
    },
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!t || mutation.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    // envia apenas mensagens reais user/assistant (sem seed do tipo 'carregando')
    mutation.mutate(next.filter((m) => m.role === "user" || m.role === "assistant"));
  };

  const suggestions = chatId ? focusedSuggestions : globalSuggestions;
  const showSuggestions = messages.length <= 1 && !mutation.isPending;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Chat IA</h1>
            <p className="text-xs text-muted-foreground">
              {chatId
                ? "Conversa específica em contexto — pergunte qualquer coisa sobre ela"
                : "Pergunte sobre o panorama das conversas monitoradas"}
            </p>
          </div>
        </div>
      </div>

      {chatId && (
        <div className="border-b border-primary/20 bg-primary/5 px-6 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-sm">
              <Target className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p>
                  <span className="text-muted-foreground">Analisando:</span>{" "}
                  <strong>{focusedName ?? chatId}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  {focused.data
                    ? `${focused.data.total.toLocaleString("pt-BR")} mensagens disponíveis pra IA.`
                    : "Carregando contexto…"}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/chat-ia" search={{ chatId: undefined }}>
                <X className="h-3 w-3" /> Sair desta conversa
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={"flex gap-3 " + (m.role === "user" ? "flex-row-reverse" : "")}>
              <div
                className={
                  "grid h-8 w-8 flex-shrink-0 place-items-center rounded-full " +
                  (m.role === "user" ? "bg-secondary" : "bg-primary/20 text-primary")
                }
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <Card
                className={
                  "max-w-[80%] " +
                  (m.role === "user" ? "bg-primary text-primary-foreground border-primary" : "")
                }
              >
                <CardContent className="p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </CardContent>
              </Card>
            </div>
          ))}

          {mutation.isPending && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="max-w-[80%]">
                <CardContent className="p-3 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </CardContent>
              </Card>
            </div>
          )}

          {showSuggestions && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border/60 bg-card/50 p-3 text-left text-sm hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 p-4">
        <form
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-border bg-muted/30 px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatId ? "Pergunte sobre essa conversa…" : "Pergunte sobre suas conversas…"}
            className="border-0 bg-transparent focus-visible:ring-0"
            disabled={mutation.isPending}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Enviar"
            disabled={mutation.isPending || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
