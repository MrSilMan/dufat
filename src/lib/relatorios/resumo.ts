/**
 * Totals for a daily report — shared by the editor (live, as lines change), the
 * admin screens, the printable document and the CSV, so the four can never
 * disagree about what a report adds up to.
 */

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
  /** Taxable when the line carries an IVA rate; the price paid when it is 0. */
  precoUnitarioCentimos: number;
  /** Hundredths of a percent (1400 = 14%) — see `lib/relatorios/dinheiro.ts`. */
  taxaIvaCentesimos: number;
  /** quantidade × unit price, IVA included. What the totals add up. */
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
  versao: number;
  linhas: LinhaVista[];
};

/** A record's own total — the sum of its lines. */
export function totalDoRegisto(registo: { linhas: readonly { valorCentimos: number }[] }): number {
  return registo.linhas.reduce((soma, linha) => soma + linha.valorCentimos, 0);
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
  numVendas: number;
  numDespesas: number;
  /** Sorted by name; a method with only expenses still gets its row. */
  porMetodo: TotalMetodo[];
};

type LinhaParaTotal = Pick<LinhaVista, "tipo" | "valorCentimos" | "metodoPagamentoNome">;

export function calcularTotais(linhas: readonly LinhaParaTotal[]): Totais {
  const metodos = new Map<string, TotalMetodo>();
  let vendas = 0;
  let despesas = 0;
  let numVendas = 0;
  let numDespesas = 0;

  for (const linha of linhas) {
    const metodo = metodos.get(linha.metodoPagamentoNome) ?? {
      nome: linha.metodoPagamentoNome,
      vendas: 0,
      despesas: 0,
      saldo: 0,
    };
    if (linha.tipo === "VENDA") {
      vendas += linha.valorCentimos;
      metodo.vendas += linha.valorCentimos;
      numVendas += 1;
    } else {
      despesas += linha.valorCentimos;
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
    numVendas,
    numDespesas,
    porMetodo: [...metodos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
  };
}
