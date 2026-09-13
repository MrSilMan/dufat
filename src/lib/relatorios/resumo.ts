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

/** A line as every screen receives it: BigInt already narrowed to a number. */
export type LinhaVista = {
  id: string;
  tipo: TipoLinha;
  descricao: string;
  valorCentimos: number;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  versao: number;
};

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
