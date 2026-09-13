/**
 * Calendar days for the daily reports, in Africa/Luanda.
 *
 * A till report belongs to the day in Luanda, not to the server's clock. Luanda
 * is UTC+1 with no daylight saving, so a server on UTC would still be on
 * "yesterday" between 00:00 and 01:00 local — long enough to file a report on
 * the wrong day, or to reject today as a future date.
 *
 * Days are passed around as `YYYY-MM-DD` strings and stored in `@db.Date`
 * columns as UTC midnight, the same convention `lib/award/periodo.ts` uses.
 */

export const FUSO_LUANDA = "Africa/Luanda";

/** A calendar day, "YYYY-MM-DD". */
export type Dia = string;

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const HOJE = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_LUANDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Luanda. `agora` is injectable for tests. */
export function hojeLuanda(agora: Date = new Date()): Dia {
  return HOJE.format(agora);
}

/** A real calendar day — "2026-02-30" matches the pattern but is not one. */
export function isDia(valor: string): valor is Dia {
  const match = DIA_RE.exec(valor);
  if (!match) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** `YYYY-MM-DD` → the UTC-midnight Date a `@db.Date` column expects. */
export function diaParaDate(dia: Dia): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/** A `@db.Date` value back to `YYYY-MM-DD`. */
export function dateParaDia(data: Date): Dia {
  return data.toISOString().slice(0, 10);
}

const ROTULO_LONGO = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const ROTULO_CURTO = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-09-12" → "Sábado, 12 de setembro de 2026". */
export function rotuloDia(dia: Dia): string {
  const rotulo = ROTULO_LONGO.format(diaParaDate(dia));
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

/** "2026-09-12" → "sáb., 12/09/2026". */
export function rotuloDiaCurto(dia: Dia): string {
  return ROTULO_CURTO.format(diaParaDate(dia));
}

const DATA_HORA = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: FUSO_LUANDA,
});

/** An instant as Luanda wall-clock time, whatever the server's zone. */
export function formatDataHoraLuanda(data: Date | string): string {
  return DATA_HORA.format(typeof data === "string" ? new Date(data) : data);
}
