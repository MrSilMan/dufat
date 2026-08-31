"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ScorePill } from "@/components/premios/ScorePill";
import { totalPenalizacoes, type LinhaRankingView } from "@/lib/award/types";

type Coluna = "posicao" | "nome" | "cargo" | "pontuacao" | "atividades" | "horas" | "penalizacoes";

const colunas: { chave: Coluna; rotulo: string; numerica: boolean }[] = [
  { chave: "posicao", rotulo: "#", numerica: true },
  { chave: "nome", rotulo: "Colaborador", numerica: false },
  { chave: "cargo", rotulo: "Cargo", numerica: false },
  { chave: "pontuacao", rotulo: "Pontuação", numerica: true },
  { chave: "atividades", rotulo: "Ativ. validadas", numerica: true },
  { chave: "horas", rotulo: "Horas validadas", numerica: true },
  { chave: "penalizacoes", rotulo: "Penalizações", numerica: true },
];

function valorDe(linha: LinhaRankingView, coluna: Coluna): number | string {
  switch (coluna) {
    case "posicao":
      return linha.posicao ?? Number.MAX_SAFE_INTEGER;
    case "nome":
      return linha.nome;
    case "cargo":
      return linha.cargoNome ?? "";
    case "pontuacao":
      return linha.pontuacaoTotal;
    case "atividades":
      return linha.componentes.volume.bruto;
    case "horas":
      return linha.componentes.horas.bruto;
    case "penalizacoes":
      return totalPenalizacoes(linha.penalizacoes);
  }
}

/**
 * The full ranking, sortable by any column.
 *
 * Sorting is client-side over the already-loaded rows: the table is one month
 * of one company, so re-querying the server to reorder a few dozen rows would
 * be slower and would risk showing a *different* calculation than the one the
 * admin is about to confirm.
 */
export function RankingTable({
  linhas,
  hrefBase,
  vencedorId,
}: {
  linhas: LinhaRankingView[];
  /** Detail URL prefix; the row's awardScoreId is appended. A prefix rather
   *  than a callback because props crossing into a client component have to
   *  serialise. */
  hrefBase: string;
  vencedorId?: string | null;
}) {
  const [ordenarPor, setOrdenarPor] = useState<Coluna>("posicao");
  const [ascendente, setAscendente] = useState(true);

  const ordenadas = useMemo(() => {
    const copia = [...linhas];
    copia.sort((a, b) => {
      const va = valorDe(a, ordenarPor);
      const vb = valorDe(b, ordenarPor);
      const cmp =
        typeof va === "string" || typeof vb === "string"
          ? String(va).localeCompare(String(vb), "pt")
          : va - vb;
      return ascendente ? cmp : -cmp;
    });
    return copia;
  }, [linhas, ordenarPor, ascendente]);

  const alternar = (coluna: Coluna) => {
    if (coluna === ordenarPor) {
      setAscendente((v) => !v);
    } else {
      setOrdenarPor(coluna);
      // Numbers are most useful highest-first; names alphabetically.
      setAscendente(coluna === "nome" || coluna === "cargo" || coluna === "posicao");
    }
  };

  return (
    <div className="card-admin overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-4xl text-sm">
          <thead>
            <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
              {colunas.map((coluna) => {
                const ativa = ordenarPor === coluna.chave;
                return (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={ativa ? (ascendente ? "ascending" : "descending") : "none"}
                    className={cn("px-5 py-3.5 font-semibold", coluna.numerica && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => alternar(coluna.chave)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-a-text",
                        ativa && "text-a-accent",
                        coluna.numerica && "flex-row-reverse",
                      )}
                    >
                      {coluna.rotulo}
                      <span aria-hidden className="text-[0.9em]">
                        {ativa ? (ascendente ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-5 py-3.5">
                <span className="sr-only">Detalhe</span>
              </th>
            </tr>
          </thead>
          <tbody className="table-rows">
            {ordenadas.map((linha) => {
              const penal = totalPenalizacoes(linha.penalizacoes);
              return (
                <tr
                  key={linha.userId}
                  className={cn(vencedorId === linha.userId && "bg-lumen/5")}
                >
                  <td className="px-5 py-3.5 text-right font-mono text-a-muted tabular-nums">
                    {linha.posicao ?? "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-a-text">{linha.nome}</p>
                    <p className="truncate text-xs text-a-faint">
                      {linha.departamentoNome ?? "Sem departamento"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-a-muted">{linha.cargoNome ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <ScorePill valor={linha.pontuacaoTotal} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-a-muted tabular-nums">
                    {linha.componentes.volume.bruto.toFixed(1)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-a-muted tabular-nums">
                    {linha.componentes.horas.bruto.toFixed(1)} h
                  </td>
                  <td
                    className={cn(
                      "px-5 py-3.5 text-right font-mono tabular-nums",
                      penal > 0 ? "text-rose-500" : "text-a-faint",
                    )}
                  >
                    {penal > 0 ? `−${penal}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`${hrefBase}/${linha.awardScoreId}`}
                      className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                    >
                      Detalhe
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
