import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, MessageSquare, Sparkles, Upload, Eye, Loader2 } from "lucide-react";
import { useRef, useState, useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiGet, apiPostForm } from "@/lib/api/client";

export const Route = createFileRoute("/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas · ScrapperBot" },
      { name: "description", content: "Todas as conversas monitoradas." },
    ],
  }),
  component: ConversasPage,
});

type Conversa = {
  chat_id: string;
  chat_name: string | null;
  total: number;
  last_ts: number | null;
  ultima: string | null;
  last_ts_fmt: string | null;
  tipo: "grupo" | "pessoa";
};

function avatarLetters(name: string | null) {
  if (!name) return "??";
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ConversasPage() {
  const qc = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busca, setBusca] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ conversas: Conversa[] }>({
    queryKey: ["conversas"],
    queryFn: () => apiGet<{ conversas: Conversa[] }>("/conversas"),
    refetchInterval: 30000,
  });

  const sincronizar = useMutation({
    mutationFn: ({ chatId, file }: { chatId: string; file: File }) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return apiPostForm<{ chat_name: string; novas: number }>(
        `/conversas/${encodeURIComponent(chatId)}/sincronizar`,
        fd,
      );
    },
    onSuccess: (d) => {
      setFeedback(`✅ ${d.chat_name}: ${d.novas} mensagem(ns) nova(s) adicionada(s)`);
      qc.invalidateQueries({ queryKey: ["conversas"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setTimeout(() => setFeedback(null), 6000);
    },
    onError: (e: Error) => {
      setFeedback(`❌ Erro: ${e.message}`);
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const conversas = data?.conversas ?? [];
  const filtradas = useMemo(() => {
    if (!busca.trim()) return conversas;
    const t = busca.toLowerCase();
    return conversas.filter((c) => (c.chat_name || c.chat_id).toLowerCase().includes(t));
  }, [conversas, busca]);

  const pick = (id: string) => fileRefs.current[id]?.click();
  const onFile = (chatId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    sincronizar.mutate({ chatId, file: f });
    e.target.value = "";
  };

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Inbox</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Conversas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${conversas.length} conversas armazenadas`}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              className="h-9 pl-9 w-64 bg-muted/40"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/importar"><Upload className="h-4 w-4" /> Importar .txt</Link>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">{feedback}</div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_360px] gap-4 border-b border-border/60 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div>Conversa</div>
            <div className="text-right">Mensagens</div>
            <div className="text-right">Última</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/60">
            {filtradas.map((c) => (
              <div
                key={c.chat_id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_360px] gap-4 items-center px-5 py-4 hover:bg-muted/40 transition-colors"
              >
                <Link to="/conversas/$id" params={{ id: c.chat_id }} className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {avatarLetters(c.chat_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.chat_name || c.chat_id}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.tipo === "grupo" ? "Grupo" : "Conversa individual"} · {c.chat_id}
                    </p>
                  </div>
                </Link>
                <div className="hidden md:block text-right tabular-nums text-sm">
                  <p className="font-semibold">{c.total.toLocaleString("pt-BR")}</p>
                </div>
                <div className="hidden md:block text-right text-xs text-muted-foreground">
                  {c.ultima || "—"}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <input
                    ref={(el) => { fileRefs.current[c.chat_id] = el; }}
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={onFile(c.chat_id)}
                  />
                  <Button asChild variant="ghost" size="icon" title="Ver mensagens">
                    <Link to="/conversas/$id" params={{ id: c.chat_id }}><Eye className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pick(c.chat_id)}
                    disabled={sincronizar.isPending}
                    title="Importar .txt do WhatsApp (só adiciona novas)"
                    className="gap-1"
                  >
                    {sincronizar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Sincronizar
                  </Button>
                  <Button asChild size="sm" className="gap-1">
                    <Link to="/chat-ia" search={{ chatId: c.chat_id }}>
                      <Sparkles className="h-3.5 w-3.5" /> Analisar com IA
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isLoading && filtradas.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <p>{busca ? "Nenhuma conversa bate com a busca." : "Nenhuma conversa armazenada ainda."}</p>
        </div>
      )}
    </div>
  );
}
