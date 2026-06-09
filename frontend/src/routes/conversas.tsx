import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Search, MessageSquare, Sparkles, Upload, Eye } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPostForm } from "@/lib/api/client";

interface Conversa {
  chat_id: string;
  chat_name: string;
  total: number;
  last_ts: number;
  ultima: string;
  last_ts_fmt: string;
  tipo: "grupo" | "pessoa";
}

interface ConversasData {
  conversas: Conversa[];
}

interface SyncResult {
  chat_name: string;
  novas: number;
  total_linhas: number;
  puladas_sistema: number;
  puladas_vazias: number;
}

export const Route = createFileRoute("/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas · BrandCast" },
      { name: "description", content: "Todas as conversas monitoradas pelo agente." },
    ],
  }),
  component: ConversasPage,
});

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function ConversasPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["conversas"],
    queryFn: () => apiGet<ConversasData>("/conversas"),
    refetchInterval: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: async (payload: { chatId: string; file: File }) => {
      const fd = new FormData();
      fd.append("arquivo", payload.file);
      return apiPostForm<SyncResult>(`/conversas/${encodeURIComponent(payload.chatId)}/sincronizar`, fd);
    },
    onSuccess: (res) => {
      setSyncMsg(`✅ ${res.chat_name}: ${res.novas} mensagem(ns) nova(s) sincronizada(s).`);
      setTimeout(() => setSyncMsg(null), 6000);
      qc.invalidateQueries({ queryKey: ["conversas"] });
    },
    onError: (err) => {
      setSyncMsg(`Falha ao sincronizar: ${(err as Error).message}`);
      setTimeout(() => setSyncMsg(null), 8000);
    },
  });

  const pick = (id: string) => fileRefs.current[id]?.click();
  const onFile = (chatId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    syncMutation.mutate({ chatId, file: f });
    e.target.value = "";
  };

  const conversas = data?.conversas ?? [];
  const filtered = conversas.filter((c) =>
    c.chat_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Inbox</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Conversas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {conversas.length} conversas monitoradas · atualiza a cada 30s
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="h-9 pl-9 w-64 bg-muted/40"
            />
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/importar"><Upload className="h-4 w-4" /> Importar .txt</Link>
          </Button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">{syncMsg}</div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Falha ao carregar conversas: {(error as Error)?.message}
        </div>
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
            {filtered.map((c) => (
              <div
                key={c.chat_id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_360px] gap-4 items-center px-5 py-4 hover:bg-muted/40 transition-colors"
              >
                <Link
                  to="/conversas/$id"
                  params={{ id: c.chat_id }}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold flex-shrink-0">
                    {iniciais(c.chat_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{c.chat_name}</p>
                      <Badge variant="secondary" className="text-[10px] py-0">
                        {c.tipo}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.ultima}</p>
                  </div>
                </Link>
                <div className="hidden md:block text-right tabular-nums text-sm">
                  <p className="font-semibold">{c.total.toLocaleString("pt-BR")}</p>
                </div>
                <div className="hidden md:block text-right text-xs text-muted-foreground">
                  {c.last_ts_fmt}
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
                    <Link to="/conversas/$id" params={{ id: c.chat_id }}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pick(c.chat_id)}
                    disabled={syncMutation.isPending}
                    title="Importar .txt exportado do WhatsApp (só adiciona msgs novas)"
                    className="gap-1"
                  >
                    <Upload className="h-3.5 w-3.5" /> Sincronizar
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

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <p>Nenhuma conversa encontrada.</p>
        </div>
      )}
    </div>
  );
}
