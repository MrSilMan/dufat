import { cn } from "@/lib/cn";

/** The score, rendered so 84.2 and 8.4 are never mistaken for each other. */
export function ScorePill({
  valor,
  destaque = false,
  className,
}: {
  valor: number;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 font-mono font-semibold tabular-nums",
        destaque ? "text-lg text-a-text" : "text-sm text-a-text",
        className,
      )}
    >
      {valor.toFixed(1)}
      <span className="text-[0.65em] font-normal text-a-faint">/100</span>
    </span>
  );
}

/** Horizontal bar for one component's contribution, 0 to its weight. */
export function BarraComponente({
  pontos,
  peso,
  className,
}: {
  pontos: number;
  peso: number;
  className?: string;
}) {
  const pct = peso > 0 ? Math.min(100, Math.max(0, (pontos / peso) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-a-inset", className)}
      role="img"
      aria-label={`${pontos.toFixed(1)} de ${peso} pontos`}
    >
      <div
        className="h-full rounded-full bg-a-accent transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
