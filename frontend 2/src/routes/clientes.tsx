import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Upload, Eye, Search, Loader2, Users } from "lucide-react";
import { useRef, useState, useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPostForm } from "@/lib/api/client";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · ScrapperBot" },
      { name: "description", content: "Grupos de cliente monitorados." },
    ],
  }),
  component: ClientesPage,
});

type Cliente = {
  chat_id: string;
  chat_name: string | null;
  total: number;
  last_ts: number | null;
  ultima: string | null;
  last_ts_fmt: string | null;
};

function avatarLetters(name: string | null) {
  if (!name) return "??";
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ClientesPage() {
  const qc = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [q, setQ] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ clientes: Cliente[] }>({
    queryKey: ["clientes"],
    queryFn: () => apiGet<{ clientes: Cliente[] }>("/clientes"),
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
      setFeedback(`✅ ${d.chat_name}: ${d.novas} mensagem(ns) nova(s)`);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversas"] });
      setTimeout(() => setFeedback(null), 6000);
    },
    onError: (e: Error) => {
      setFeedback(`❌ Erro: ${e.message}`);
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const clientes = data?.clientes ?? [];
  const filtered = useMemo(
    () =>
      !q.trim()
        ? clientes
        : clientes.filter((c) => (c.chat_name || c.chat_id).toLowerCase().includes(q.toLowerCase())),
    [clientes, q],
  );

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
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Carteira</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Clientes <span className="text-muted-foreground text-base font-normal">({isLoading ? "…" : clientes.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grupos monitorados. Clique em <em>Analisar com IA</em> pra abrir o chat com a conversa no contexto.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="h-9 pl-9 w-56 bg-muted/40" />
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/importar"><Upload className="h-4 w-4" /> Importar .txt</Link>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm">{feedback}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((c) => (
          <Card key={c.chat_id} className="h-full flex flex-col">
            <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold shrink-0">
                  {avatarLetters(c.chat_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{c.chat_name || c.chat_id}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Última: {c.ultima || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <div>
                  <p className="font-semibold tabular-nums">{c.total.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground">mensagens</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{c.last_ts_fmt || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">última msg</p>
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
                  <Link to="/conversas/$id" params={{ id: c.chat_id }}><Eye className="h-3.5 w-3.5" /> Ver</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => pick(c.chat_id)}
                  disabled={sincronizar.isPending}
                  title="Importar .txt do WhatsApp"
                >
                  {sincronizar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Sync
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
          <p>{q ? "Nenhum cliente bate com a busca." : "Nenhum cliente monitorado ainda."}</p>
        </div>
      )}
    </div>
  );
}
