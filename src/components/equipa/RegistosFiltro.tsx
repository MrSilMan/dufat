import Link from "next/link";
import { cn } from "@/lib/cn";
import type { FiltroRegistos } from "@/lib/equipa/folha";

type Contagens = Record<FiltroRegistos, number>;

const CHIPS: { valor: FiltroRegistos; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "validadas", label: "Validadas" },
  { valor: "justificacao", label: "Em justificação" },
  { valor: "pendentes", label: "Pendentes" },
];

/**
 * Filter chips, as links rather than client state — the filter belongs in the
 * URL so "Ver e justificar" on Início can land straight on the filtered list.
 */
export function RegistosFiltro({
  ativo,
  contagens,
}: {
  ativo: FiltroRegistos;
  contagens: Contagens;
}) {
  return (
    <nav aria-label="Filtrar registos" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 pb-1 md:w-auto md:flex-wrap">
        {CHIPS.map((chip) => {
          const selecionado = chip.valor === ativo;
          return (
            <li key={chip.valor}>
              <Link
                href={
                  chip.valor === "todas"
                    ? "/equipa/registos"
                    : { pathname: "/equipa/registos", query: { filtro: chip.valor } }
                }
                aria-current={selecionado ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                  selecionado
                    ? "border-a-accent/35 bg-a-accent-soft text-a-text"
                    : "border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text",
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    selecionado ? "text-a-accent" : "text-a-muted",
                  )}
                >
                  {contagens[chip.valor]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
