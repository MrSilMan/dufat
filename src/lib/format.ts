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
