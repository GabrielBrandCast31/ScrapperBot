import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Sparkles, Upload, Eye, Search, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPostForm } from "@/lib/api/client";

interface Cliente {
  chat_id: string;
  chat_name: string;
  total: number;
  last_ts: number;
  ultima: string;
  last_ts_fmt: string;
}

interface ClientesData {
  clientes: Cliente[];
}

interface SyncResult {
  chat_name: string;
  novas: number;
  total_linhas: number;
  puladas_sistema: number;
  puladas_vazias: number;
}

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · BrandCast" },
      { name: "description", content: "Conversas individuais (pessoas) monitoradas." },
    ],
  }),
  component: ClientesPage,
});

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => apiGet<ClientesData>("/clientes"),
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
      qc.invalidateQueries({ queryKey: ["clientes"] });
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

  const clientes = data?.clientes ?? [];
  const filtered = clientes.filter((c) =>
    c.chat_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Carteira</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Clientes <span className="text-muted-foreground text-base font-normal">({clientes.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em <em>IA</em> pra abrir o chat com a conversa do cliente no contexto.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="h-9 pl-9 w-56 bg-muted/40"
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
          Falha ao carregar clientes: {(error as Error)?.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((c) => (
          <Card key={c.chat_id} className="h-full flex flex-col">
            <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold flex-shrink-0">
                  {iniciais(c.chat_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{c.chat_name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.last_ts_fmt}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{c.ultima}</p>
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <div>
                  <p className="font-semibold tabular-nums">{c.total.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground">mensagens</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <input
                  ref={(el) => { fileRefs.current[c.chat_id] = el; }}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={onFile(c.chat_id)}
                />
                <Button asChild variant="ghost" size="sm" className="gap-1 flex-1">
                  <Link to="/conversas/$id" params={{ id: c.chat_id }}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => pick(c.chat_id)}
                  disabled={syncMutation.isPending}
                >
                  <Upload className="h-3.5 w-3.5" /> Sync
                </Button>
                <Button asChild size="sm" className="gap-1 flex-1">
                  <Link to="/chat-ia" search={{ chatId: c.chat_id }}>
                    <Sparkles className="h-3.5 w-3.5" /> IA
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Users className="h-8 w-8" />
          <p>Nenhum cliente encontrado.</p>
        </div>
      )}
    </div>
  );
}
