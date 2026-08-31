import { cn } from "@/lib/cn";
import { BarraComponente, ScorePill } from "@/components/premios/ScorePill";
import {
  EXPLICACOES_COMPONENTE,
  ROTULOS_COMPONENTE,
  totalPenalizacoes,
  type Componentes,
  type Penalizacao,
} from "@/lib/award/types";

const ORDEM: (keyof Componentes)[] = [
  "volume",
  "horas",
  "consistencia",
  "qualidade",
  "pontualidade",
];

const ORIGEM_MEDIANA: Record<string, string> = {
  cargo: "mediana do cargo neste mês",
  historico: "mediana histórica do cargo (poucas pessoas no cargo este mês)",
  empresa: "mediana da empresa (sem dados suficientes do cargo)",
  indisponivel: "sem mediana disponível",
};

/** How a raw figure is worded for each component. */
function formatarBruto(chave: keyof Componentes, bruto: number): string {
  switch (chave) {
    case "volume":
      return `${bruto.toFixed(1)} atividades`;
    case "horas":
      return `${bruto.toFixed(1)} h`;
    case "consistencia":
      return `${bruto.toFixed(0)} dias`;
    default:
      return `${(bruto * 100).toFixed(0)}%`;
  }
}

/**
 * The full "why this score" breakdown, component by component.
 *
 * Shared by the admin's employee detail screen and the employee's own view —
 * the answer to "why not me?" has to be the same document whoever is asking,
 * or the award stops being trusted.
 */
export function ScoreBreakdown({
  componentes,
  penalizacoes,
  pontuacaoTotal,
  className,
}: {
  componentes: Componentes;
  penalizacoes: Penalizacao[];
  pontuacaoTotal: number;
  className?: string;
}) {
  const subtotal = ORDEM.reduce((sum, chave) => sum + componentes[chave].pontos, 0);
  const descontos = totalPenalizacoes(penalizacoes);

  return (
    <div className={cn("space-y-6", className)}>
      <ul className="space-y-5">
        {ORDEM.map((chave) => {
          const c = componentes[chave];
          return (
            <li key={chave}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-a-text">
                  {ROTULOS_COMPONENTE[chave]}
                  <span className="ml-2 text-xs font-normal text-a-faint">peso {c.peso}%</span>
                </p>
                <p className="font-mono text-sm tabular-nums text-a-text">
                  {c.pontos.toFixed(1)}
                  <span className="text-xs text-a-faint"> / {c.peso}</span>
                </p>
              </div>

              <BarraComponente pontos={c.pontos} peso={c.peso} className="mt-2" />

              <p className="mt-2 text-xs text-a-muted">
                <span className="font-medium text-a-text">{formatarBruto(chave, c.bruto)}</span>
                {c.mediana !== null && (
                  <>
                    {" "}
                    contra {formatarBruto(chave, c.mediana)}
                    {c.origemMediana && ` (${ORIGEM_MEDIANA[c.origemMediana] ?? ""})`}
                  </>
                )}
                {" → "}
                {(c.normalizado * 100).toFixed(0)}% do componente.
              </p>
              <p className="mt-1 text-xs text-a-faint">{EXPLICACOES_COMPONENTE[chave]}</p>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t border-a-line pt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-a-muted">Subtotal dos componentes</span>
          <span className="font-mono tabular-nums text-a-text">{subtotal.toFixed(1)}</span>
        </div>

        {penalizacoes.length === 0 ? (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-a-muted">Penalizações</span>
            <span className="font-mono tabular-nums text-a-faint">—</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {penalizacoes.map((p) => (
              <li key={p.tipo} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-a-muted">
                  {p.rotulo}
                  {p.quantidade > 1 && (
                    <span className="ml-1.5 text-xs text-a-faint">×{p.quantidade}</span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-rose-500">
                  −{p.pontos.toFixed(0)}
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between border-t border-a-line pt-1.5 text-sm">
              <span className="text-a-muted">Total das penalizações</span>
              <span className="font-mono tabular-nums text-rose-500">
                −{descontos.toFixed(0)}
              </span>
            </li>
          </ul>
        )}

        <div className="flex items-baseline justify-between border-t border-a-line pt-3">
          <span className="font-display text-base font-bold text-a-text">Pontuação final</span>
          <ScorePill valor={pontuacaoTotal} destaque />
        </div>
      </div>
    </div>
  );
}
