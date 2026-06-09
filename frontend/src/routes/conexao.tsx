import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Smartphone,
  CheckCircle2,
  RefreshCcw,
  Power,
  Wifi,
  Play,
  Pause,
  RotateCw,
  AlertTriangle,
  QrCode,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, apiAssetUrl } from "@/lib/api/client";

interface ConexaoStatus {
  status: string;
  me?: { id?: string; pushName?: string } | null;
  engine?: { engine?: string; WWebVersion?: string; state?: string } | null;
}

const statusColor: Record<string, string> = {
  WORKING: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  STARTING: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  SCAN_QR_CODE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  FAILED: "bg-destructive/20 text-destructive border-destructive/40",
  STOPPED: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  WORKING: "Conectado",
  STARTING: "Iniciando",
  SCAN_QR_CODE: "Escaneie o QR",
  FAILED: "Falhou",
  STOPPED: "Parado",
};

export const Route = createFileRoute("/conexao")({
  head: () => ({
    meta: [
      { title: "Conexão · BrandCast" },
      { name: "description", content: "Status da sessão WhatsApp do monitor." },
    ],
  }),
  component: ConexaoPage,
});

function ConexaoPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["conexao"],
    queryFn: () => apiGet<ConexaoStatus>("/conexao/status"),
    refetchInterval: 3_000,
  });

  const [qrTick, setQrTick] = useState(0);
  useEffect(() => {
    if (data?.status !== "SCAN_QR_CODE") return;
    const t = setInterval(() => setQrTick((n) => n + 1), 3_000);
    return () => clearInterval(t);
  }, [data?.status]);

  const onSuccess = () => qc.invalidateQueries({ queryKey: ["conexao"] });
  const start = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/start"), onSuccess });
  const stop = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/stop"), onSuccess });
  const restart = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/restart"), onSuccess });
  const logout = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/logout"), onSuccess });
  const reconectar = useMutation({ mutationFn: () => apiPost<unknown>("/conexao/reconectar"), onSuccess });

  const status = data?.status ?? "STOPPED";
  const numero = data?.me?.id ? data.me.id.replace(/@c\.us$/, "") : "—";
  const pushName = data?.me?.pushName ?? "";
  const engineName = data?.engine?.engine ?? "—";
  const wwebVersion = data?.engine?.WWebVersion ?? "";

  const canStart = ["STOPPED", "FAILED"].includes(status);
  const canRestart = ["WORKING", "STARTING", "SCAN_QR_CODE"].includes(status);
  const canStop = ["WORKING", "STARTING", "SCAN_QR_CODE"].includes(status);
  const canLogout = ["WORKING", "SCAN_QR_CODE"].includes(status);
  const canReconnect = status !== "STARTING";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Infraestrutura</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Conexão</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status da sessão do WhatsApp usada pelo monitor — atualiza a cada 3s.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className={`mt-1 ${statusColor[status] ?? statusColor.STOPPED}`}>
                {statusLabel[status] ?? status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Número</p>
              <p className="font-semibold truncate">{numero}</p>
              {pushName && <p className="text-xs text-muted-foreground truncate">{pushName}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Motor</p>
              <p className="font-semibold truncate">{engineName}</p>
              {wwebVersion && <p className="text-xs text-muted-foreground truncate">v{wwebVersion}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessão WhatsApp</CardTitle>
          <CardDescription>
            {status === "SCAN_QR_CODE"
              ? "Abra o WhatsApp no celular, vá em Dispositivos conectados e escaneie o código abaixo."
              : status === "WORKING"
                ? "Sessão ativa. Mensagens estão sendo capturadas em tempo real."
                : "Use os botões abaixo pra iniciar, reconectar ou parar a sessão."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="grid h-56 w-56 place-items-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground text-sm text-center p-4 overflow-hidden">
              {status === "SCAN_QR_CODE" ? (
                <img
                  key={qrTick}
                  src={`${apiAssetUrl("/conexao/qr")}?t=${qrTick}`}
                  alt="QR Code WhatsApp"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <QrCode className="h-10 w-10 opacity-50" />
                  <p>QR Code aparece aqui<br />quando a sessão precisa ser pareada.</p>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3 text-sm">
              {isLoading && <p className="text-muted-foreground">Consultando status…</p>}
              {data?.engine?.state && (
                <p className="text-muted-foreground">
                  Estado do motor: <span className="font-medium text-foreground">{data.engine.state}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {canStart && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => start.mutate()}
                    disabled={start.isPending}
                  >
                    <Play className="h-4 w-4" /> Iniciar
                  </Button>
                )}
                {canReconnect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => reconectar.mutate()}
                    disabled={reconectar.isPending}
                  >
                    <RefreshCcw className="h-4 w-4" /> Reconectar
                  </Button>
                )}
                {canRestart && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => restart.mutate()}
                    disabled={restart.isPending}
                  >
                    <RotateCw className="h-4 w-4" /> Reiniciar
                  </Button>
                )}
                {canStop && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => stop.mutate()}
                    disabled={stop.isPending}
                  >
                    <Pause className="h-4 w-4" /> Parar
                  </Button>
                )}
                {canLogout && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <Power className="h-4 w-4" /> Desconectar
                  </Button>
                )}
              </div>
              {(start.isError || stop.isError || restart.isError || logout.isError || reconectar.isError) && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Falha na ação. Tente novamente em alguns segundos.</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
