import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaSuffix?: string;
  icon: LucideIcon;
  invertDelta?: boolean; // when lower is better (e.g. response time)
  accent?: "primary" | "warning" | "danger" | "info";
}

const accentMap = {
  primary: "bg-primary/15 text-primary",
  warning: "bg-[oklch(0.82_0.16_80/0.18)] text-[oklch(0.82_0.16_80)]",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-[oklch(0.72_0.15_230/0.18)] text-[oklch(0.78_0.15_230)]",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix = "%",
  icon: Icon,
  invertDelta,
  accent = "primary",
}: KpiCardProps) {
  const isPositive = delta === undefined ? null : invertDelta ? delta < 0 : delta > 0;
  return (
    <Card className="bg-card/60 border-border/60 hover:border-border transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
          </div>
          <div className={cn("rounded-lg p-2", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {delta !== undefined && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                isPositive
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta)}
              {deltaSuffix}
            </span>
            <span className="text-muted-foreground">vs. semana anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}