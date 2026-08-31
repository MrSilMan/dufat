/**
 * The anti-gaming rules, in one place.
 *
 * `Atividade.possivelInconsistencia` is a single boolean — the row records
 * *that* something looked off, never *which* rule fired. Rather than widen the
 * schema, the reasons are re-derived from the entry and its siblings whenever
 * they need to be shown: the inputs are already loaded for the list, and a
 * derived answer can never disagree with a stale stored one.
 *
 * `detetarInconsistencia` in the server action imports the same predicates, so
 * what gets flagged at write time and what gets explained at read time cannot
 * drift apart.
 */

/** Entries shorter than this are flagged for review. */
export const MINUTOS_CURTOS = 10;

/** More entries than this on one day is not a plausible day of work. */
export const MAX_ENTRADAS_DIA = 15;

type Intervalo = { inicioEm: Date; fimEm: Date };

export function duracaoCurta(minutos: number): boolean {
  return minutos < MINUTOS_CURTOS;
}

/** Half-open overlap: touching ends (09:30–10:00, 10:00–10:45) do not count. */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicioEm < b.fimEm && b.inicioEm < a.fimEm;
}

export type EntradaComparavel = {
  id: string;
  dia: Date;
  categoriaId: string;
  inicioEm: Date;
  fimEm: Date;
  minutos: number;
  estado: string;
};

/**
 * Why this entry is flagged, in the employee's own words — one sentence per
 * rule that actually applies, so nobody has to guess which of three
 * possibilities is theirs.
 *
 * `doMes` is every entry on the sheet; only same-day, non-rejected siblings are
 * considered, which is exactly the set the write-time check queries.
 */
export function motivosInconsistencia(
  atividade: EntradaComparavel,
  doMes: readonly EntradaComparavel[],
): string[] {
  const motivos: string[] = [];

  const irmas = doMes.filter(
    (outra) =>
      outra.id !== atividade.id &&
      outra.estado !== "REJEITADA" &&
      outra.dia.getTime() === atividade.dia.getTime(),
  );

  if (duracaoCurta(atividade.minutos)) {
    motivos.push(`Duração inferior a ${MINUTOS_CURTOS} minutos.`);
  }

  if (irmas.length + 1 > MAX_ENTRADAS_DIA) {
    motivos.push(`Mais de ${MAX_ENTRADAS_DIA} registos neste dia.`);
  }

  const sobreposta = irmas.find(
    (irma) => irma.categoriaId === atividade.categoriaId && sobrepoe(atividade, irma),
  );
  if (sobreposta) {
    motivos.push("O horário sobrepõe-se a outro registo da mesma categoria neste dia.");
  }

  return motivos;
}
