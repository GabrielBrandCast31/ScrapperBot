import { cn } from "@/lib/utils";
import type { Sentiment } from "@/lib/mock-data";

const map: Record<Sentiment, { label: string; className: string }> = {
  positive: { label: "Positivo", className: "bg-primary/15 text-primary border-primary/30" },
  neutral: { label: "Neutro", className: "bg-muted text-muted-foreground border-border" },
  negative: { label: "Negativo", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function SentimentBadge({ value, className }: { value: Sentiment; className?: string }) {
  const s = map[value];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function HealthDot({ health }: { health: "healthy" | "attention" | "risk" }) {
  const color =
    health === "healthy"
      ? "bg-primary"
      : health === "attention"
        ? "bg-[oklch(0.82_0.16_80)]"
        : "bg-destructive";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", color)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}