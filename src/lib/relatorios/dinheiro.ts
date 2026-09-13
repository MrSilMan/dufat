/**
 * Money for the daily sales/expense reports, held as integer Kwanza cêntimos.
 *
 * Nothing here goes through a float: amounts are parsed from the typed string
 * digit by digit and formatted from the integer's quotient and remainder, so
 * "0,10 + 0,20" can never come out as 0,30000000000000004 on a till report.
 *
 * Safe on the client — the editor parses as the colaborador types.
 */

/** 10 000 000 000,00 Kz — far above any real line, well inside 2^53. */
export const MAX_CENTIMOS = 1_000_000_000_000;

const INTEIRO = new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 });

/**
 * Parses what someone typed into cêntimos, or null if it is not an amount.
 *
 * Accepts the pt-AO form ("1 500,50", "1.500,50") and the dot-decimal a phone's
 * numeric keypad often produces ("1500.50"). A lone dot followed by exactly
 * three digits ("1.500") is read as a thousands separator, as a pt-AO reader
 * would; one or two digits after it ("12.5") are decimals.
 */
export function parseValorCentimos(texto: string): number | null {
  const limpo = texto.replace(/[\s\u00a0\u202f]/g, "").replace(/kz$/i, "");
  if (!limpo || !/^[\d.,]+$/.test(limpo)) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");

  let inteiro: string;
  let decimal = "";

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Both present: whichever comes last is the decimal separator.
    const separador = Math.max(ultimaVirgula, ultimoPonto);
    inteiro = limpo.slice(0, separador).replace(/[.,]/g, "");
    decimal = limpo.slice(separador + 1);
  } else if (ultimaVirgula >= 0) {
    if (limpo.indexOf(",") !== ultimaVirgula) return null;
    inteiro = limpo.slice(0, ultimaVirgula);
    decimal = limpo.slice(ultimaVirgula + 1);
  } else if (ultimoPonto >= 0) {
    const partes = limpo.split(".");
    const milhares = partes.length > 2 || partes[partes.length - 1]!.length === 3;
    if (milhares) {
      if (partes.slice(1).some((parte) => parte.length !== 3)) return null;
      inteiro = partes.join("");
    } else {
      inteiro = partes[0]!;
      decimal = partes[1]!;
    }
  } else {
    inteiro = limpo;
  }

  if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(decimal)) return null;
  if (inteiro === "" && decimal === "") return null;

  const centimos = Number(inteiro || "0") * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(centimos) || centimos > MAX_CENTIMOS) return null;
  return centimos;
}

/** 150050 → "1 500,50 Kz". */
export function formatCentimos(centimos: number): string {
  return `${formatCentimosNumero(centimos)} Kz`;
}

/** 150050 → "1 500,50" — for table cells that already say Kz in the header. */
export function formatCentimosNumero(centimos: number): string {
  const sinal = centimos < 0 ? "−" : "";
  const absoluto = Math.abs(centimos);
  const inteiro = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  return `${sinal}${INTEIRO.format(inteiro)},${String(resto).padStart(2, "0")}`;
}

/** 150050 → "1500,50" — what goes back into an input, and into CSV cells. */
export function centimosParaTexto(centimos: number): string {
  const sinal = centimos < 0 ? "-" : "";
  const absoluto = Math.abs(centimos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, "0")}`;
}
