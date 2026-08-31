import Link from "next/link";
import { cn } from "@/lib/cn";
import { ScorePill } from "@/components/premios/ScorePill";
import type { LinhaRankingView } from "@/lib/award/types";

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join("");
}

/** Gold, silver, bronze — in DUFAT's palette rather than literal metals. */
const lugares = [
  { ordem: 1, rotulo: "1.º", ring: "ring-lumen", chip: "bg-lumen/20 text-lumen-deep", altura: "md:mt-0" },
  { ordem: 2, rotulo: "2.º", ring: "ring-dufat-sky", chip: "bg-dufat-mist text-dufat", altura: "md:mt-8" },
  { ordem: 3, rotulo: "3.º", ring: "ring-a-line-strong", chip: "bg-a-inset text-a-muted", altura: "md:mt-12" },
];

/**
 * Top three, with the winner centred on wide screens.
 *
 * Order is 2-1-3 in the DOM on desktop only via `order` classes; the natural
 * 1-2-3 order is preserved for narrow screens and screen readers.
 */
export function Podium({
  linhas,
  vencedorId,
  hrefBase,
}: {
  linhas: LinhaRankingView[];
  vencedorId?: string | null;
  /** Detail URL prefix; the row's awardScoreId is appended. */
  hrefBase: string;
}) {
  const top = linhas.slice(0, 3);
  if (top.length === 0) return null;

  const ordemDesktop = ["md:order-2", "md:order-1", "md:order-3"];

  return (
    <ol className="grid gap-4 md:grid-cols-3 md:items-start">
      {top.map((linha, i) => {
        const lugar = lugares[i]!;
        const confirmado = vencedorId === linha.userId;
        return (
          <li key={linha.userId} className={cn(ordemDesktop[i], lugar.altura)}>
            <Link
              href={`${hrefBase}/${linha.awardScoreId}`}
              className={cn(
                "card-admin flex flex-col items-center gap-3 p-6 text-center transition-colors hover:border-a-line-strong",
                confirmado && "border-lumen/50",
              )}
            >
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.16em]",
                  lugar.chip,
                )}
              >
                {lugar.rotulo}
              </span>

              {linha.photoUrl ? (
                /* Avatars are small, arbitrary uploads; the optimiser adds nothing. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={linha.photoUrl}
                  alt=""
                  className={cn("h-20 w-20 rounded-full object-cover ring-2", lugar.ring)}
                />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-xl font-bold text-white ring-2",
                    lugar.ring,
                  )}
                >
                  {iniciais(linha.nome)}
                </span>
              )}

              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-a-text">
                  {linha.nome}
                </p>
                <p className="truncate text-xs text-a-muted">{linha.cargoNome ?? "—"}</p>
              </div>

              <ScorePill valor={linha.pontuacaoTotal} destaque />

              {confirmado && (
                <span className="rounded-full bg-lumen/15 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wider text-lumen-deep">
                  Vencedor confirmado
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
