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
// A rate is held in hundredths of a percent: 14% is 1400, and 0 is exempt.
//
// The rate alone does not say what it does to the price — `precoIncluiIva`
// does. A line filled in from an INVGEST document states a taxable price and
// the tax goes on top, exactly as the document does it. A line someone types
// at the till states the price that was paid, tax already inside, and the
// base and the tax are derived from it for the report.

/** 100,00% — nothing real comes close, and it keeps the arithmetic bounded. */
export const MAX_TAXA_IVA = 10_000;

/** Hundredths of a percent as a person writes them: 1400 → "14%"; 1750 → "17,5%". */
export function percentagemParaTexto(centesimos: number): string {
  const inteiro = Math.floor(centesimos / 100);
  const decimal = String(centesimos % 100).padStart(2, "0").replace(/0+$/, "");
  return decimal ? `${inteiro},${decimal}%` : `${inteiro}%`;
}

/** 1400 → "14%"; 1750 → "17,5%". */
export function taxaIvaParaTexto(taxaIvaCentesimos: number): string {
  return percentagemParaTexto(taxaIvaCentesimos);
}

/**
 * Splits a tax-inclusive total into its base and its IVA, in cêntimos.
 *
 * The total is what the customer actually paid, so it is the fixed quantity
 * here: the base is rounded and the tax is whatever is left, which makes
 * `base + imposto === total` exactly, for every total and every rate.
 *
 * This is not the inverse of the taxable case in `calcularLinha` and cannot
 * be. That one rounds the tax up, as AGT requires when a document states a
 * taxable price; going back the other way from a rounded gross cannot always
 * land on a base whose rounded-up tax returns the same gross. A till line is
 * not a document — the gross is the fact, and the split is derived from it.
 */
export function repartirIvaIncluido(
  totalCentimos: number,
  taxaIvaCentesimos: number,
): { base: number; imposto: number } {
  const taxa = Math.min(Math.max(Math.round(taxaIvaCentesimos), 0), MAX_TAXA_IVA);
  if (taxa === 0 || totalCentimos === 0) return { base: totalCentimos, imposto: 0 };

  const total = BigInt(totalCentimos);
  const denominador = 10000n + BigInt(taxa);
  const base = Number((total * 10000n + denominador / 2n) / denominador);
  return { base, imposto: totalCentimos - base };
}

// ---------- Descontos ----------
//
// A discount is one optional field, typed either way: "10%" is a percentage,
// anything else an amount in Kz. It comes off the price the way the line
// states it — the price paid at the till, the taxable price on a document —
// so the IVA is always worked out on what was actually charged, which is what
// AGT requires of a discount given on the document itself.
//
// A record can also carry a discount on the whole bill. That one comes off the
// total paid and is spread over the lines in proportion to what each came to,
// so a sale mixing taxed and exempt articles still reports the IVA it carried.

/** A discount as it was given: a share of the amount, or an amount off it. */
export type Desconto =
  | { tipo: "PERCENTAGEM"; /** Hundredths of a percent: 1000 is 10%. */ centesimos: number }
  | { tipo: "VALOR"; /** Cêntimos off. */ centimos: number };

/** 100% — an article given away is a discount too. */
export const MAX_DESCONTO_PERCENTAGEM = 10_000;

/**
 * Reads a discount field.
 *
 * Empty is no discount — the ordinary case — and so is a zero. "10%", "12,5 %"
 * and "0.5%" are percentages, with at most two decimals; anything else has to
 * read as an amount, in the forms {@link parseValorCentimos} accepts. A leading
 * minus is allowed and ignored: people write a discount as what comes off.
 *
 * Text that is neither comes back as "invalido" rather than as no discount. A
 * typo in a discount has to be pointed out, not quietly charged at full price.
 */
export function parseDesconto(texto: string): Desconto | null | "invalido" {
  const limpo = texto.replace(/[\s  ]/g, "").replace(/^[-−]/, "");
  if (!limpo) return null;

  if (limpo.endsWith("%")) {
    const partes = /^(\d+)(?:[.,](\d{1,2}))?%$/.exec(limpo);
    if (!partes) return "invalido";
    const centesimos = Number(partes[1]) * 100 + Number((partes[2] ?? "").padEnd(2, "0"));
    if (!Number.isSafeInteger(centesimos) || centesimos > MAX_DESCONTO_PERCENTAGEM) {
      return "invalido";
    }
    return centesimos === 0 ? null : { tipo: "PERCENTAGEM", centesimos };
  }

  const centimos = parseValorCentimos(limpo);
  if (centimos === null) return "invalido";
  return centimos === 0 ? null : { tipo: "VALOR", centimos };
}

/** A discount back in the field's own words: "10%", "12,5%", "1500,00"; "" for none. */
export function descontoParaTexto(desconto: Desconto | null): string {
  if (!desconto) return "";
  return desconto.tipo === "PERCENTAGEM"
    ? percentagemParaTexto(desconto.centesimos)
    : centimosParaTexto(desconto.centimos);
}

/** Whether two discounts are the same one; two absent ones are. */
export function mesmoDesconto(a: Desconto | null, b: Desconto | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.tipo === "PERCENTAGEM") return b.tipo === "PERCENTAGEM" && a.centesimos === b.centesimos;
  return b.tipo === "VALOR" && a.centimos === b.centimos;
}

/**
 * What a discount takes off an amount, in cêntimos — never more than the
 * amount itself. A percentage rounds half-up to the cêntimo.
 */
function descontoSobre(desconto: Desconto | null, montante: bigint): bigint {
  if (!desconto || montante <= 0n) return 0n;
  if (desconto.tipo === "VALOR") {
    const valor = BigInt(Math.max(Math.round(desconto.centimos), 0));
    return valor < montante ? valor : montante;
  }
  const centesimos = BigInt(
    Math.min(Math.max(Math.round(desconto.centesimos), 0), MAX_DESCONTO_PERCENTAGEM),
  );
  return (montante * centesimos + 5000n) / 10000n;
}

// ---------- Pricing a line and a record ----------

/** What a line needs to be priced. */
export type LinhaParaCalculo = {
  quantidadeMil: number;
  precoUnitarioCentimos: number;
  taxaIvaCentesimos: number;
  precoIncluiIva: boolean;
  desconto: Desconto | null;
};

/**
 * A line priced, every figure in cêntimos. They always add up:
 * `semDesconto = total + descontoLinha + descontoRegisto`.
 */
export type LinhaCalculada = {
  /** quantidade × unit price before any discount — taxable or as paid, as the price is. */
  bruto: number;
  /** What the line would come to with no discount at all, IVA included. */
  semDesconto: number;
  /** What the line's own discount took off that, the IVA it spared included. */
  descontoLinha: number;
  /** The line's share of its record's discount. */
  descontoRegisto: number;
  /** What the line comes to, IVA included and both discounts taken: what the totals add up. */
  total: number;
  /** How much of `total` is IVA. */
  iva: number;
};

/** A cêntimo figure as a number; past 2^53 it is capped, and `MAX_CENTIMOS` checks refuse it. */
function numero(valor: bigint): number {
  const limite = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(valor > limite ? limite : valor);
}

/**
 * Prices one line: quantidade × unit price, less the line's discount, plus the
 * IVA when the rate is one that goes on top of the price, less the line's share
 * of its record's discount.
 *
 * Exact arithmetic throughout: `2,5 × 85 000,00 Kz` is exactly 212 500,00 Kz,
 * not 212 499,999… The product of two in-range values can still leave 2^53, so
 * it is taken as a BigInt.
 *
 * The roundings are not all the same, and that is deliberate.
 *
 * The product and a percentage discount round half-up, the ordinary rounding.
 *
 * The tax on a taxable price is rounded **up to the next cêntimo**, once, on
 * the line's discounted taxable total. That is the AGT rule for
 * `taxContribution` in electronic invoicing — "o valor calculado neste campo
 * deverá ser arredondado por excesso para o cêntimo seguinte" (23,144 → 23,15;
 * 0,001844 → 0,01) — and INVGEST follows it, so it is the only way a record
 * imported from a document lands on the document's own total: 2 × 17 105,26 is
 * 34 210,52 + 4 789,48 = 39 000,00 there and here, where rounding the tax
 * half-up would have said 38 999,99.
 *
 * A share of the record's discount comes off the line's total, tax included,
 * because that is what a discount on the bill comes off. A line that takes one
 * then has its IVA derived from what it finally came to, as a till line's is:
 * its total is no longer a document's, and it is the paid amount that holds.
 */
export function calcularLinha(linha: LinhaParaCalculo, descontoRegisto = 0): LinhaCalculada {
  const produto = BigInt(linha.quantidadeMil) * BigInt(linha.precoUnitarioCentimos);
  const bruto = (produto + 500n) / 1000n;
  const taxa = BigInt(Math.min(Math.max(Math.round(linha.taxaIvaCentesimos), 0), MAX_TAXA_IVA));
  // A taxable price has its tax added on top; an inclusive or an exempt one is
  // already the whole amount.
  const porCima = taxa > 0n && !linha.precoIncluiIva;
  const comIva = (base: bigint) => (porCima ? base + (base * taxa + 9999n) / 10000n : base);

  const liquido = bruto - descontoSobre(linha.desconto, bruto);
  const semDesconto = comIva(bruto);
  const antes = comIva(liquido);
  const pedido = BigInt(Math.max(Math.round(descontoRegisto), 0));
  const partilha = pedido < antes ? pedido : antes;
  const total = antes - partilha;

  let iva = 0n;
  if (taxa > 0n) {
    iva =
      porCima && partilha === 0n
        ? antes - liquido
        : BigInt(repartirIvaIncluido(numero(total), Number(taxa)).imposto);
  }

  return {
    bruto: numero(bruto),
    semDesconto: numero(semDesconto),
    descontoLinha: numero(semDesconto - antes),
    descontoRegisto: numero(partilha),
    total: numero(total),
    iva: numero(iva),
  };
}

/** A record priced: its lines, and its own discount spread over them. */
export type RegistoCalculado = {
  linhas: LinhaCalculada[];
  /** What the lines come to before the record's own discount. */
  subtotal: number;
  /** What the record's discount took off the subtotal. */
  desconto: number;
  /** What was paid: `subtotal − desconto`, and exactly the sum of the lines' totals. */
  total: number;
};

/**
 * Prices a whole record. The record's discount is worked out on the lines'
 * total and then spread over them, so that every line still says how much
 * of it was IVA — the report adds that up, and an exempt article must not be
 * reported as carrying tax because a discount on the bill happened to land on
 * it.
 */
export function calcularRegisto(
  linhas: readonly LinhaParaCalculo[],
  desconto: Desconto | null,
): RegistoCalculado {
  const antes = linhas.map((linha) => calcularLinha(linha));
  const subtotal = antes.reduce((soma, linha) => soma + linha.total, 0);
  const valor = numero(descontoSobre(desconto, BigInt(subtotal)));
  if (valor === 0) return { linhas: antes, subtotal, desconto: 0, total: subtotal };

  const partes = repartir(
    valor,
    antes.map((linha) => linha.total),
  );
  return {
    linhas: linhas.map((linha, indice) => calcularLinha(linha, partes[indice])),
    subtotal,
    desconto: valor,
    total: subtotal - valor,
  };
}

/**
 * Splits `valor` cêntimos over `pesos` in proportion to them, exactly: the
 * shares add up to `valor`, and none is larger than its own weight.
 *
 * Largest remainder: each share is first rounded down, and the cêntimos left
 * over go one each to the shares that lost the most in that rounding, earliest
 * line first on a tie. A share only gains a cêntimo when its exact value was
 * not whole, so it never passes its weight — a line cannot be discounted into
 * a negative total.
 */
function repartir(valor: number, pesos: readonly number[]): number[] {
  const soma = BigInt(pesos.reduce((acumulado, peso) => acumulado + peso, 0));
  const total = BigInt(valor);
  if (total <= 0n || soma <= 0n) return pesos.map(() => 0);

  const partes = pesos.map((peso) => (total * BigInt(peso)) / soma);
  let falta = total - partes.reduce((acumulado, parte) => acumulado + parte, 0n);
  const ordem = pesos
    .map((peso, indice) => ({ indice, resto: (total * BigInt(peso)) % soma }))
    .sort((a, b) => (a.resto === b.resto ? a.indice - b.indice : a.resto > b.resto ? -1 : 1));
  for (const { indice } of ordem) {
    if (falta === 0n) break;
    partes[indice]! += 1n;
    falta -= 1n;
  }
  return partes.map(numero);
}
