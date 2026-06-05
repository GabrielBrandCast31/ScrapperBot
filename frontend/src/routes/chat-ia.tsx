import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { Sparkles, Send, Bot, User, Target, X, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api/client";

type ChatSearch = { chatId?: string };

export const Route = createFileRoute("/chat-ia")({
  head: () => ({
    meta: [
      { title: "Chat IA · ScrapperBot" },
      { name: "description", content: "Pergunte qualquer coisa sobre suas conversas auditadas." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    chatId: typeof s.chatId === "string" ? s.chatId : undefined,
  }),
  component: ChatIaPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const globalSuggestions = [
  "Liste os clientes monitorados",
  "Panorama geral do banco",
  "Buscar mensagens com 'atrasado'",
  "Quais conversas tiveram mais atividade hoje?",
];

const focusedSuggestions = [
  "Resume essa conversa",
  "Qual o tom do cliente nas últimas semanas?",
  "O que ficou prometido e ainda não foi entregue?",
  "Pontos de atenção que eu deveria saber",
];

type ConversaInfo = { chat_id: string; chat_name: string; total: number };

function ChatIaPage() {
  const { chatId } = Route.useSearch();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quando ha chat_id, busca o nome via API pra mostrar no banner
  const { data: conversaInfo } = useQuery<ConversaInfo | null>({
    queryKey: ["chat-ia-info", chatId],
    queryFn: async () => {
      if (!chatId) return null;
      const d = await apiGet<{ chat_id: string; chat_name: string; total: number }>(
        `/conversas/${encodeURIComponent(chatId)}?limit=1`,
      );
      return { chat_id: d.chat_id, chat_name: d.chat_name, total: d.total };
    },
    enabled: !!chatId,
  });

  const seedContent = useMemo(() => {
    if (chatId) {
      const nome = conversaInfo?.chat_name ?? "essa conversa";
      return `Tô com a conversa de **${nome}** em contexto. A IA já recebeu o transcript completo. Pergunte direto — posso resumir, identificar pontos em aberto, tom geral, ou qualquer trecho específico.`;
    }
    return "Olá! Pergunte qualquer coisa sobre as conversas armazenadas. Posso buscar mensagens, listar clientes, dar panorama geral, etc.";
  }, [chatId, conversaInfo?.chat_name]);

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: seedContent }]);
  const [input, setInput] = useState("");

  // Atualiza a seed quando muda o chatId/nome
  useEffect(() => {
    setMessages([{ role: "assistant", content: seedContent }]);
  }, [seedContent]);

  // Auto-scroll quando chegam novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const perguntar = useMutation({
    mutationFn: async (texto: string) => {
      const novaHistoria = [
        ...messages.filter((m) => m.role === "user" || m.role === "assistant").slice(1), // drop seed
        { role: "user" as const, content: texto },
      ];
      return apiPost<{ resposta: string }>("/chat-ia/perguntar", {
        historia: novaHistoria,
        chat_id: chatId || "",
      });
    },
    onSuccess: (d, texto) => {
      setMessages((m) => [
        ...m,
        { role: "user", content: texto },
        { role: "assistant", content: d.resposta },
      ]);
    },
    onError: (e: Error, texto) => {
      setMessages((m) => [
        ...m,
        { role: "user", content: texto },
        { role: "assistant", content: `❌ Erro: ${e.message}` },
      ]);
    },
  });

  const send = (text: string) => {
    if (!text.trim() || perguntar.isPending) return;
    setInput("");
    perguntar.mutate(text);
  };

  const suggestions = chatId ? focusedSuggestions : globalSuggestions;

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
                : "Pergunte sobre as conversas armazenadas"}
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
                  <strong>{conversaInfo?.chat_name || chatId}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  {conversaInfo
                    ? `A IA recebe o transcript dessa conversa (até 1500 msgs) como contexto.`
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

      <div className="flex-1 overflow-y-auto px-6 py-6">
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

          {perguntar.isPending && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="max-w-[80%]">
                <CardContent className="p-3 text-sm leading-relaxed flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </CardContent>
              </Card>
            </div>
          )}

          {messages.length === 1 && !perguntar.isPending && (
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

          <div ref={messagesEndRef} />
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
            placeholder="Pergunte sobre suas conversas…"
            disabled={perguntar.isPending}
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={perguntar.isPending}>
            {perguntar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
