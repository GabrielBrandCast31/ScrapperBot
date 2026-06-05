import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone,
  CheckCircle2,
  RefreshCcw,
  Power,
  Wifi,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, apiAssetUrl } from "@/lib/api/client";

export const Route = createFileRoute("/conexao")({
  head: () => ({
    meta: [
      { title: "Conexão · ScrapperBot" },
      { name: "description", content: "Status da conexão com o WhatsApp e gestão de sessão." },
    ],
  }),
  component: ConexaoPage,
});

type SessionInfo = {
  status: string | null;
  me: { id?: string; pushName?: string } | null;
  engine: { engine?: string; WWebVersion?: string; state?: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  WORKING: "Conectado",
  STARTING: "Iniciando…",
  SCAN_QR_CODE: "Aguardando pareamento",
  STOPPED: "Parado",
  FAILED: "Falhou",
};

function statusColor(status: string | null | undefined) {
  switch (status) {
    case "WORKING":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "STARTING":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "SCAN_QR_CODE":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function ConexaoPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SessionInfo>({
    queryKey: ["conexao", "status"],
    queryFn: () => apiGet<SessionInfo>("/conexao/status"),
    refetchInterval: 3000,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["conexao"] });
  const iniciar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/start"), onSuccess: invalidar });
  const parar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/stop"), onSuccess: invalidar });
  const reiniciar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/restart"), onSuccess: invalidar });
  const desconectar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/logout"), onSuccess: invalidar });
  const reconectar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/reconectar"), onSuccess: invalidar });

  const status = data?.status ?? null;
  const cor = statusColor(status);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Infraestrutura</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Conexão</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status da sessão do WhatsApp utilizada pelo monitor de atendimento.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-lg border ${cor}`}>
              {status === "WORKING" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold">
                {isLoading ? "Verificando…" : (STATUS_LABEL[status ?? ""] || status || "Desconhecido")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Número</p>
              <p className="font-semibold">
                {data?.me?.id ? data.me.id.replace("@c.us", "") : "—"}
              </p>
              {data?.me?.pushName && (
                <p className="text-xs text-muted-foreground">{data.me.pushName}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Motor</p>
              <p className="font-semibold">{data?.engine?.engine ?? "—"}</p>
              {data?.engine?.WWebVersion && (
                <p className="text-xs text-muted-foreground">WA Web {data.engine.WWebVersion}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Sessão WhatsApp</CardTitle>
              <CardDescription>
                {status === "WORKING" && "Sessão ativa e capturando mensagens em tempo real."}
                {status === "STARTING" && "Inicializando o motor — aguarde alguns segundos."}
                {status === "SCAN_QR_CODE" && "Aponte a câmera do WhatsApp para o QR abaixo."}
                {status === "STOPPED" && "Sessão parada. Clique em Iniciar para começar."}
                {status === "FAILED" && "A sessão falhou. Use Reconectar para gerar um novo QR."}
                {!status && "Verificando estado da sessão…"}
              </CardDescription>
            </div>
            {status && (
              <Badge variant="outline" className={cor}>
                {status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {status === "SCAN_QR_CODE" ? (
              <img
                key={`qr-${Math.floor(Date.now() / 3000)}`}
                src={apiAssetUrl("/conexao/qr")}
                alt="QR Code"
                className="h-56 w-56 rounded-lg border bg-white p-2"
              />
            ) : (
              <div className="grid h-56 w-56 place-items-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground text-sm text-center p-4">
                {status === "WORKING" ? (
                  <span>✅ Pareado<br />Nenhuma ação necessária</span>
                ) : (
                  <span>QR Code aparecerá aqui<br />quando a sessão precisar parear</span>
                )}
              </div>
            )}
            <div className="flex-1 space-y-4 text-sm">
              <p className="text-muted-foreground">
                A captura roda em segundo plano. <strong>Reconectar</strong> é o atalho quando o celular desvincula o aparelho — faz logout + start em 1 clique e gera um novo QR.
              </p>
              <div className="flex flex-wrap gap-2">
                {(status === "STOPPED" || status === "FAILED" || !status) && (
                  <Button onClick={() => iniciar.mutate()} disabled={iniciar.isPending} className="gap-2">
                    {iniciar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    ▶ Iniciar
                  </Button>
                )}
                {status !== "STARTING" && (
                  <Button
                    onClick={() => reconectar.mutate()}
                    disabled={reconectar.isPending}
                    variant="secondary"
                    className="gap-2"
                  >
                    {reconectar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Reconectar
                  </Button>
                )}
                {(status === "WORKING" || status === "STARTING" || status === "SCAN_QR_CODE") && (
                  <Button onClick={() => reiniciar.mutate()} disabled={reiniciar.isPending} variant="outline" className="gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Reiniciar
                  </Button>
                )}
                {(status === "WORKING" || status === "STARTING" || status === "SCAN_QR_CODE") && (
                  <Button onClick={() => parar.mutate()} disabled={parar.isPending} variant="outline" className="gap-2">
                    ⏸ Parar
                  </Button>
                )}
                {(status === "WORKING" || status === "SCAN_QR_CODE") && (
                  <Button onClick={() => desconectar.mutate()} disabled={desconectar.isPending} variant="destructive" className="gap-2">
                    <Power className="h-4 w-4" />
                    Desconectar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Atualizado em tempo real (polling a cada 3s).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
