/**
 * Totals for a daily report — shared by the editor (live, as lines change), the
 * admin screens, the printable document and the CSV, so the four can never
 * disagree about what a report adds up to.
 */

import {
  calcularLinha,
  formatCentimos,
  percentagemParaTexto,
  taxaIvaParaTexto,
  type Desconto,
} from "@/lib/relatorios/dinheiro";

export type TipoLinha = "VENDA" | "DESPESA";
export type EstadoRelatorio = "RASCUNHO" | "FINALIZADO";

export const ROTULO_TIPO: Record<TipoLinha, string> = {
  VENDA: "Venda",
  DESPESA: "Despesa",
};

/**
 * What the two sides of a record are called. A sale is made to a client; an
 * expense is paid to a supplier, and calling that a "client" on screen is how
 * a till report starts reading like nonsense.
 */
export const ROTULO_CONTRAPARTE: Record<TipoLinha, string> = {
  VENDA: "Cliente",
  DESPESA: "Fornecedor",
};

/** A line as every screen receives it: BigInt already narrowed to a number. */
export type LinhaVista = {
  id: string;
  tipo: TipoLinha;
  descricao: string;
  /** Thousandths of a unit — see `lib/relatorios/dinheiro.ts`. */
  quantidadeMil: number;
  /** Taxable, or the price paid with the tax inside — see `precoIncluiIva`. */
  precoUnitarioCentimos: number;
  /** Hundredths of a percent (1400 = 14%); 0 is exempt. */
  taxaIvaCentesimos: number;
  /** Whether the unit price already contains that IVA — see `dinheiro.ts`. */
  precoIncluiIva: boolean;
  /** The discount on this article as it was given; null when there is none. */
  desconto: Desconto | null;
  /** What that discount took off the line's total, IVA included. */
  descontoCentimos: number;
  /** The line's share of its record's discount — see `calcularRegisto`. */
  descontoRegistoCentimos: number;
  /**
   * What the line comes to: quantidade × unit price, IVA included, both
   * discounts taken. What every total adds up.
   */
  valorCentimos: number;
  artigoInvgestId: string | null;
  artigoCodigo: string | null;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  ordem: number;
};

/**
 * One sale or expense with its lines — the unit a colaborador adds and edits.
 *
 * `versao` covers the record and every line under it: they are written in one
 * transaction, so there is only ever one thing for a second tab to conflict on.
 */
export type RegistoVista = {
  id: string;
  tipo: TipoLinha;
  /** Client (sale) or supplier (expense); null when nobody was named. */
  clienteNome: string | null;
  clienteNif: string | null;
  clienteInvgestId: string | null;
  facturaInvgestId: string | null;
  facturaCodigo: string | null;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  nota: string | null;
  /** The discount on the whole bill as it was given; null when there is none. */
  desconto: Desconto | null;
  versao: number;
  linhas: LinhaVista[];
};

/** A record's own total — the sum of its lines, its discount already taken. */
export function totalDoRegisto(registo: { linhas: readonly { valorCentimos: number }[] }): number {
  return registo.linhas.reduce((soma, linha) => soma + linha.valorCentimos, 0);
}

/** What the record's own discount took off, spread over its lines and added back up. */
export function descontoDoRegisto(registo: {
  linhas: readonly { descontoRegistoCentimos: number }[];
}): number {
  return registo.linhas.reduce((soma, linha) => soma + linha.descontoRegistoCentimos, 0);
}

/**
 * What a line shows on the bill: after its own discount, before its record's.
 * The record's discount is shown once, under the lines, as a bill shows it.
 */
export function valorDaLinha(
  linha: Pick<LinhaVista, "valorCentimos" | "descontoRegistoCentimos">,
): number {
  return linha.valorCentimos + linha.descontoRegistoCentimos;
}

export type TotalMetodo = {
  nome: string;
  vendas: number;
  despesas: number;
  saldo: number;
};

export type Totais = {
  vendas: number;
  despesas: number;
  /** Vendas − despesas. */
  saldo: number;
  /** How much of `vendas` is IVA — 0 when every line is exempt. */
  ivaVendas: number;
  /** How much of `despesas` is IVA. */
  ivaDespesas: number;
  /** What discounts took off `vendas` — the articles' own and the records'. */
  descontosVendas: number;
  /** What discounts took off `despesas`. */
  descontosDespesas: number;
  numVendas: number;
  numDespesas: number;
  /** Sorted by name; a method with only expenses still gets its row. */
  porMetodo: TotalMetodo[];
};

type LinhaParaTotal = Pick<
  LinhaVista,
  | "tipo"
  | "valorCentimos"
  | "metodoPagamentoNome"
  | "quantidadeMil"
  | "precoUnitarioCentimos"
  | "taxaIvaCentesimos"
  | "precoIncluiIva"
  | "desconto"
  | "descontoCentimos"
  | "descontoRegistoCentimos"
>;

export function calcularTotais(linhas: readonly LinhaParaTotal[]): Totais {
  const metodos = new Map<string, TotalMetodo>();
  let vendas = 0;
  let despesas = 0;
  let ivaVendas = 0;
  let ivaDespesas = 0;
  let descontosVendas = 0;
  let descontosDespesas = 0;
  let numVendas = 0;
  let numDespesas = 0;

  for (const linha of linhas) {
    // The line's share of its record's discount is stored with it, so its
    // IVA comes out as it did when the record was saved.
    const { iva } = calcularLinha(linha, linha.descontoRegistoCentimos);
    const desconto = linha.descontoCentimos + linha.descontoRegistoCentimos;
    const metodo = metodos.get(linha.metodoPagamentoNome) ?? {
      nome: linha.metodoPagamentoNome,
      vendas: 0,
      despesas: 0,
      saldo: 0,
    };
    if (linha.tipo === "VENDA") {
      vendas += linha.valorCentimos;
      ivaVendas += iva;
      descontosVendas += desconto;
      metodo.vendas += linha.valorCentimos;
      numVendas += 1;
    } else {
      despesas += linha.valorCentimos;
      ivaDespesas += iva;
      descontosDespesas += desconto;
      metodo.despesas += linha.valorCentimos;
      numDespesas += 1;
    }
    metodo.saldo = metodo.vendas - metodo.despesas;
    metodos.set(linha.metodoPagamentoNome, metodo);
  }

  return {
    vendas,
    despesas,
    saldo: vendas - despesas,
    ivaVendas,
    ivaDespesas,
    descontosVendas,
    descontosDespesas,
    numVendas,
    numDespesas,
    porMetodo: [...metodos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
  };
}

/**
 * How a line's IVA reads on screen, in print and in the CSV — or null when the
 * line says nothing about tax at all.
 *
 * Three cases, and the difference between the last two matters. A taxable
 * price has the tax waiting above it. An inclusive price at 0% is a line
 * someone marked exempt — a statement. A line with no rate and no inclusive
 * flag is one written before the choice existed: it claims nothing, and
 * putting "Isento" on it would be inventing a claim on its author's behalf.
 */
export function rotuloIvaDaLinha(
  linha: Pick<LinhaVista, "taxaIvaCentesimos" | "precoIncluiIva">,
): string | null {
  if (linha.taxaIvaCentesimos > 0) {
    const taxa = taxaIvaParaTexto(linha.taxaIvaCentesimos);
    return linha.precoIncluiIva ? `IVA ${taxa} incl.` : `+ IVA ${taxa}`;
  }
  return linha.precoIncluiIva ? "Isento" : null;
}

/** "10%" or "1 500,00 Kz" — how a discount reads in a report. */
export function rotuloDesconto(desconto: Desconto): string {
  return desconto.tipo === "PERCENTAGEM"
    ? percentagemParaTexto(desconto.centesimos)
    : formatCentimos(desconto.centimos);
}

/**
 * How a line's discount reads under it — "desconto 10% · −14 000,00 Kz" — or
 * null when it has none. An amount typed as an amount is not repeated; it only
 * differs from what came off when the price was taxable and the discount took
 * the IVA on it along.
 */
export function rotuloDescontoDaLinha(
  linha: Pick<LinhaVista, "desconto" | "descontoCentimos">,
): string | null {
  if (!linha.desconto) return null;
  const valor = `−${formatCentimos(linha.descontoCentimos)}`;
  if (linha.desconto.tipo === "VALOR" && linha.desconto.centimos === linha.descontoCentimos) {
    return `desconto ${valor}`;
  }
  return `desconto ${rotuloDesconto(linha.desconto)} · ${valor}`;
}

/** "Desconto no total (5%)", or without the brackets when an amount was given. */
export function rotuloDescontoDoRegisto(registo: Pick<RegistoVista, "desconto">): string {
  return registo.desconto?.tipo === "PERCENTAGEM"
    ? `Desconto no total (${rotuloDesconto(registo.desconto)})`
    : "Desconto no total";
}
