/** Formats a numeric string as Angolan Kwanza, e.g. "55 000,00 Kz". */
export function formatKz(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Sob consulta";
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(amount)) return "Sob consulta";
  return `${new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} Kz`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

/**
 * Human duration from a minute count: "45min", "6h", "6h 30min".
 *
 * Activity is stored in minutes, which is right for arithmetic and unreadable
 * on screen — nobody reads "390 min" as six and a half hours. The unit is kept
 * on both halves so the value can never be mistaken for a clock time sitting
 * next to it.
 */
export function formatDuracao(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas === 0) return `${resto}min`;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}
