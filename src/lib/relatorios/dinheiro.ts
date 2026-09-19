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

// ---------- Quantities ----------
//
// Held as thousandths of a unit, so "2,5 m" is 2500 and a quantity is never a
// float either: 0,1 + 0,2 units of anything must be 0,3.

/** Above any real line, and keeps quantity × price inside 2^53. */
export const MAX_QUANTIDADE_MIL = 999_999_000;

/**
 * Parses a typed quantity into thousandths, or null if it is not one.
 *
 * Accepts "2", "2,5" and "2.5" — a phone's numeric keypad produces the dot —
 * and at most three decimals. Unlike an amount, a bare dot here is always a
 * decimal point: nobody buys 1.500 luminárias.
 */
export function parseQuantidadeMil(texto: string): number | null {
  const limpo = texto.replace(/[\s  ]/g, "").replace(",", ".");
  if (!limpo || !/^\d*\.?\d*$/.test(limpo) || limpo === ".") return null;

  const [inteiro = "", decimal = ""] = limpo.split(".");
  if (decimal.length > 3) return null;

  const mil = Number(inteiro || "0") * 1000 + Number(decimal.padEnd(3, "0") || "0");
  if (!Number.isSafeInteger(mil) || mil <= 0 || mil > MAX_QUANTIDADE_MIL) return null;
  return mil;
}

/** 2500 → "2,5"; 1000 → "1". Trailing zeros are dropped, as people write them. */
export function quantidadeMilParaTexto(mil: number): string {
  const inteiro = Math.floor(mil / 1000);
  const decimal = String(mil % 1000).padStart(3, "0").replace(/0+$/, "");
  return decimal ? `${inteiro},${decimal}` : String(inteiro);
}

// ---------- IVA ----------
//
// A rate is held in hundredths of a percent: 14% is 1400. Only lines filled in
// from an INVGEST document carry one — there the price is the taxable one and
// the tax is added on top, exactly as the document does it. A line someone
// typed carries 0: the price they wrote is already the price that was paid.

/** 100,00% — nothing real comes close, and it keeps the arithmetic bounded. */
export const MAX_TAXA_IVA = 10_000;

/** 1400 → "14%"; 1750 → "17,5%". */
export function taxaIvaParaTexto(taxaIvaCentesimos: number): string {
  const inteiro = Math.floor(taxaIvaCentesimos / 100);
  const decimal = String(taxaIvaCentesimos % 100).padStart(2, "0").replace(/0+$/, "");
  return decimal ? `${inteiro},${decimal}%` : `${inteiro}%`;
}

/**
 * quantidade × unit price (+ IVA, when the line carries a rate), in cêntimos.
 *
 * Exact arithmetic throughout: `2,5 × 85 000,00 Kz` is exactly 212 500,00 Kz,
 * not 212 499,999… The product of two in-range values can still leave 2^53, so
 * it is taken as a BigInt; a total that large comes back as an unsafe-looking
 * number that the caller's `MAX_CENTIMOS` check then refuses.
 *
 * The two roundings are not the same, and that is deliberate.
 *
 * The taxable total rounds half-up, the ordinary arithmetic rounding.
 *
 * The tax is rounded **up to the next cêntimo**, once, on the line's taxable
 * total. That is the AGT rule for `taxContribution` in electronic invoicing —
 * "o valor calculado neste campo deverá ser arredondado por excesso para o
 * cêntimo seguinte" (23,144 → 23,15; 0,001844 → 0,01) — and INVGEST follows
 * it, so it is the only way a record imported from a document lands on the
 * document's own total: 2 × 17 105,26 is 34 210,52 + 4 789,48 = 39 000,00
 * there and here, where rounding the tax half-up would have said 38 999,99.
 *
 * Every argument is non-negative — the parsers refuse anything else — so the
 * `+500` is a half-up rounding rather than a half-away-from-zero one, and the
 * `+9999` a ceiling rather than a floor.
 */
export function totalDaLinha(
  quantidadeMil: number,
  precoUnitarioCentimos: number,
  taxaIvaCentesimos = 0,
): number {
  const produto = BigInt(quantidadeMil) * BigInt(precoUnitarioCentimos);
  const liquido = (produto + 500n) / 1000n;
  const taxa = BigInt(Math.min(Math.max(Math.round(taxaIvaCentesimos), 0), MAX_TAXA_IVA));
  const centimos = taxa === 0n ? liquido : liquido + (liquido * taxa + 9999n) / 10000n;
  const limite = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(centimos > limite ? limite : centimos);
}
