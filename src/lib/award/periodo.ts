/**
 * Period and working-day arithmetic for the "Funcionário do Mês" award.
 *
 * Everything here works on plain `YYYY-MM-DD` strings and UTC dates. The sheet
 * is a record of *calendar days* in Angola, not instants, so pulling days out
 * of a local-time Date would shift entries across midnight for anyone whose
 * server clock is not on WAT.
 */

/** A month, "YYYY-MM". */
export type Periodo = string;
/** A calendar day, "YYYY-MM-DD". */
export type Dia = string;

const PERIODO_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ANO_RE = /^\d{4}$/;

export function isPeriodo(value: string): value is Periodo {
  return PERIODO_RE.test(value);
}

export function isAno(value: string): boolean {
  return ANO_RE.test(value);
}

export function parsePeriodo(periodo: Periodo): { ano: number; mes: number } {
  const match = PERIODO_RE.exec(periodo);
  if (!match) throw new Error(`Período inválido: "${periodo}" (esperado YYYY-MM)`);
  return { ano: Number(match[1]), mes: Number(match[2]) };
}

/** "2026-08" → { start: 2026-08-01T00:00Z, endExclusive: 2026-09-01T00:00Z }. */
export function monthRange(periodo: Periodo): { start: Date; endExclusive: Date } {
  const { ano, mes } = parsePeriodo(periodo);
  return {
    start: new Date(Date.UTC(ano, mes - 1, 1)),
    endExclusive: new Date(Date.UTC(ano, mes, 1)),
  };
}

/** The twelve months of a year, oldest first. */
export function mesesDoAno(ano: string): Periodo[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

/** The month before this one. */
export function periodoAnterior(periodo: Periodo): Periodo {
  const { ano, mes } = parsePeriodo(periodo);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return toPeriodo(d);
}

export function toPeriodo(date: Date): Periodo {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function toDia(date: Date): Dia {
  return date.toISOString().slice(0, 10);
}

/** Whole days between two `YYYY-MM-DD` strings (b − a). */
export function diasEntre(a: Dia, b: Dia): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Monday–Friday. Angola's standard working week. */
function isDiaUtil(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Mon–Fri days in the month, ignoring anyone's contract. */
export function diasUteisNoMes(periodo: Periodo): number {
  const { start, endExclusive } = monthRange(periodo);
  let count = 0;
  for (const d = new Date(start); d < endExclusive; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isDiaUtil(d)) count += 1;
  }
  return count;
}

export type IntervaloAusencia = { inicio: Dia; fim: Dia };

export type ExpectativaInput = {
  periodo: Periodo;
  /** Contracted days per week. 5 = full time. */
  diasSemana: number;
  /** Hire date; days before it do not count. */
  dataAdmissao?: Dia | null;
  /** Leaving date; days after it do not count. */
  dataSaida?: Dia | null;
  /** Approved absences only — pending ones must not shrink the expectation. */
  ausencias?: IntervaloAusencia[];
};

/**
 * How many days this specific person was actually expected to work this month.
 *
 * This is the denominator of the consistency score and the basis for pro-rating
 * the minimum-days eligibility rule, so it has to reflect the individual: a
 * mid-month hire, approved leave and a part-time contract all shrink it. Using
 * a flat 22 instead would quietly punish exactly the people who did nothing
 * wrong.
 *
 * Part time is applied as a ratio rather than by guessing *which* weekdays
 * someone works — the contract records how many days a week, not which.
 */
export function diasEsperados(input: ExpectativaInput): number {
  const { start, endExclusive } = monthRange(input.periodo);
  const ausencias = input.ausencias ?? [];

  let uteis = 0;
  for (const d = new Date(start); d < endExclusive; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!isDiaUtil(d)) continue;
    const dia = toDia(d);
    if (input.dataAdmissao && dia < input.dataAdmissao) continue;
    if (input.dataSaida && dia > input.dataSaida) continue;
    if (ausencias.some((a) => dia >= a.inicio && dia <= a.fim)) continue;
    uteis += 1;
  }

  const semana = Math.min(Math.max(input.diasSemana, 1), 7);
  return Math.round((uteis * semana) / 5);
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-08" → "Agosto de 2026". "2026" is passed through. */
export function rotuloPeriodo(periodo: string): string {
  if (isAno(periodo)) return periodo;
  if (!isPeriodo(periodo)) return periodo;
  const { ano, mes } = parsePeriodo(periodo);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** The month we are in right now, in UTC. */
export function periodoAtual(): Periodo {
  return toPeriodo(new Date());
}
