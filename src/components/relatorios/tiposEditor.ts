import {
  calcularLinha,
  calcularRegisto,
  centimosParaTexto,
  descontoParaTexto,
  mesmoDesconto,
  parseDesconto,
  parseQuantidadeMil,
  parseValorCentimos,
  quantidadeMilParaTexto,
  repartirPagamento,
  MAX_CENTIMOS,
  type Desconto,
  type LinhaCalculada,
  type LinhaParaCalculo,
  type RegistoCalculado,
} from "@/lib/relatorios/dinheiro";
import type { RegistoVista, TipoLinha } from "@/lib/relatorios/resumo";

/**
 * What the editor holds while a record is being filled in, and the small rules
 * the card, the autosave and the local backup all have to agree on.
 *
 * Everything a person types stays a string until it is saved — an input whose
 * value is a parsed number cannot hold "1 50" on the way to "1 500", and the
 * amounts are parsed with the same functions the server uses.
 *
 * Optional links are "" rather than null so a restored backup and a fresh form
 * compare equal without either side normalising first.
 */

export type Metodo = { id: string; nome: string };

export type CamposLinha = {
  id: string;
  descricao: string;
  quantidade: string;
  precoUnitario: string;
  /**
   * IVA in hundredths of a percent (1400 = 14%); 0 is exempt. A line filled in
   * from an INVGEST document carries the document's rate; one written by hand
   * is toggled between the standard rate and exempt.
   */
  taxaIva: number;
  /**
   * Whether the price typed already contains that IVA. True for a line written
   * by hand — the price is what was paid — and false for one from a document,
   * which states a taxable price with the tax on top.
   */
  precoIncluiIva: boolean;
  /** The discount as typed — "10%", "1 500" — or "" for none, the usual case. */
  desconto: string;
  artigoInvgestId: string;
  artigoCodigo: string;
};

/**
 * One way the record was paid. `valor` is the amount typed for it, on every
 * way but the last; the last takes whatever of the total is left, and what
 * its `valor` holds is never read.
 */
export type CamposPagamento = {
  metodoPagamentoId: string;
  valor: string;
};

export type CamposRegisto = {
  tipo: TipoLinha;
  clienteNome: string;
  clienteNif: string;
  clienteInvgestId: string;
  facturaInvgestId: string;
  facturaCodigo: string;
  nota: string;
  /** The discount on the whole bill, typed like an article's. */
  desconto: string;
  /** Never empty: one entry when it was paid one way, one per method when split. */
  pagamentos: CamposPagamento[];
  linhas: CamposLinha[];
};

export type EstadoRegisto =
  | "novo"
  | "guardado"
  | "por_guardar"
  | "a_guardar"
  | "incompleto"
  | "erro"
  | "sem_ligacao"
  | "conflito";

export type Registo = {
  id: string;
  /** The last copy the server confirmed; null until the first save lands. */
  base: RegistoVista | null;
  campos: CamposRegisto;
  estado: EstadoRegisto;
  mensagem?: string;
  /**
   * Keyed by field, `linhas.<id>.<campo>` for a line's own, and
   * `pagamentos.<posição>.<campo>` for a payment's.
   */
  errors?: Record<string, string[]>;
  /** In the "conflito" state: the record as the server has it, or null if deleted. */
  atual?: RegistoVista | null;
  /** Restored from this device's backup of a previous visit. */
  recuperado?: boolean;
};

export const TIPOS: TipoLinha[] = ["VENDA", "DESPESA"];

export function novoId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 14% — the standard Angolan rate, and what a new line starts on. */
export const TAXA_NORMAL = 1400;

export function linhaVazia(): CamposLinha {
  return {
    id: novoId(),
    descricao: "",
    quantidade: "1",
    precoUnitario: "",
    // Most of what crosses the till is taxed, so a new line starts there; the
    // price typed is the price paid, which is why the rate sits inside it and
    // the total is the same either way the toggle is left.
    taxaIva: TAXA_NORMAL,
    precoIncluiIva: true,
    desconto: "",
    artigoInvgestId: "",
    artigoCodigo: "",
  };
}

export function registoVazio(tipo: TipoLinha, metodoPagamentoId: string): CamposRegisto {
  return {
    tipo,
    clienteNome: "",
    clienteNif: "",
    clienteInvgestId: "",
    facturaInvgestId: "",
    facturaCodigo: "",
    nota: "",
    desconto: "",
    pagamentos: [{ metodoPagamentoId, valor: "" }],
    linhas: [linhaVazia()],
  };
}

/** A saved record, back in the shape the inputs hold. */
export function camposDe(registo: RegistoVista): CamposRegisto {
  return {
    tipo: registo.tipo,
    clienteNome: registo.clienteNome ?? "",
    clienteNif: registo.clienteNif ?? "",
    clienteInvgestId: registo.clienteInvgestId ?? "",
    facturaInvgestId: registo.facturaInvgestId ?? "",
    facturaCodigo: registo.facturaCodigo ?? "",
    nota: registo.nota ?? "",
    desconto: descontoParaTexto(registo.desconto),
    pagamentos: registo.pagamentos.map((pagamento, indice, todos) => ({
      metodoPagamentoId: pagamento.metodoPagamentoId,
      // The last one's amount is the rest of the total, not something typed.
      valor: indice < todos.length - 1 ? centimosParaTexto(pagamento.valorCentimos) : "",
    })),
    linhas: registo.linhas.map((linha) => ({
      id: linha.id,
      descricao: linha.descricao,
      quantidade: quantidadeMilParaTexto(linha.quantidadeMil),
      precoUnitario: centimosParaTexto(linha.precoUnitarioCentimos),
      taxaIva: linha.taxaIvaCentesimos,
      precoIncluiIva: linha.precoIncluiIva,
      desconto: descontoParaTexto(linha.desconto),
      artigoInvgestId: linha.artigoInvgestId ?? "",
      artigoCodigo: linha.artigoCodigo ?? "",
    })),
  };
}

/** Whether a typed discount is the one saved — unreadable text never is. */
function mesmoDescontoTexto(texto: string, guardado: Desconto | null): boolean {
  const lido = parseDesconto(texto);
  return lido !== "invalido" && mesmoDesconto(lido, guardado);
}

/**
 * Whether what is on screen is what the server last confirmed.
 *
 * Compared through the parsed amounts, not the text: "1500" and "1 500,00" are
 * the same money, and re-saving on the difference would write a version nobody
 * asked for every time a field is reformatted.
 */
export function iguais(campos: CamposRegisto, base: RegistoVista): boolean {
  const opcional = (valor: string) => valor.trim() || null;
  if (
    campos.tipo !== base.tipo ||
    opcional(campos.clienteNome) !== base.clienteNome ||
    opcional(campos.clienteNif) !== base.clienteNif ||
    opcional(campos.clienteInvgestId) !== base.clienteInvgestId ||
    opcional(campos.facturaInvgestId) !== base.facturaInvgestId ||
    opcional(campos.facturaCodigo) !== base.facturaCodigo ||
    opcional(campos.nota) !== base.nota ||
    !mesmoDescontoTexto(campos.desconto, base.desconto) ||
    campos.pagamentos.length !== base.pagamentos.length ||
    campos.linhas.length !== base.linhas.length
  ) {
    return false;
  }

  // The last payment's amount follows from the lines, which are compared below.
  const mesmosPagamentos = campos.pagamentos.every((pagamento, indice) => {
    const guardado = base.pagamentos[indice]!;
    return (
      pagamento.metodoPagamentoId === guardado.metodoPagamentoId &&
      (indice === campos.pagamentos.length - 1 ||
        parseValorCentimos(pagamento.valor) === guardado.valorCentimos)
    );
  });
  if (!mesmosPagamentos) return false;

  return campos.linhas.every((linha, indice) => {
    const guardada = base.linhas[indice]!;
    return (
      linha.id === guardada.id &&
      linha.descricao.trim() === guardada.descricao &&
      parseQuantidadeMil(linha.quantidade) === guardada.quantidadeMil &&
      parseValorCentimos(linha.precoUnitario) === guardada.precoUnitarioCentimos &&
      linha.taxaIva === guardada.taxaIvaCentesimos &&
      linha.precoIncluiIva === guardada.precoIncluiIva &&
      mesmoDescontoTexto(linha.desconto, guardada.desconto) &&
      opcional(linha.artigoInvgestId) === guardada.artigoInvgestId &&
      opcional(linha.artigoCodigo) === guardada.artigoCodigo
    );
  });
}

/** Nothing has been filled in: an untouched card, not an unfinished one. */
export function vazio(campos: CamposRegisto): boolean {
  return (
    !campos.clienteNome.trim() &&
    !campos.nota.trim() &&
    !campos.desconto.trim() &&
    campos.linhas.every(
      (linha) => !linha.descricao.trim() && !linha.precoUnitario.trim() && !linha.desconto.trim(),
    )
  );
}

/**
 * A line as the pricing reads it, or null while its quantity, price or
 * discount does not read yet.
 */
function linhaParaCalculo(linha: CamposLinha): LinhaParaCalculo | null {
  const quantidadeMil = parseQuantidadeMil(linha.quantidade);
  const precoUnitarioCentimos = parseValorCentimos(linha.precoUnitario);
  const desconto = parseDesconto(linha.desconto);
  if (
    quantidadeMil === null ||
    precoUnitarioCentimos === null ||
    precoUnitarioCentimos <= 0 ||
    desconto === "invalido"
  ) {
    return null;
  }
  return {
    quantidadeMil,
    precoUnitarioCentimos,
    taxaIvaCentesimos: linha.taxaIva,
    precoIncluiIva: linha.precoIncluiIva,
    desconto,
  };
}

/**
 * The amounts typed for every way of paying but the last, or null while one
 * of them does not read or is nothing.
 */
function parciaisDoPagamento(campos: CamposRegisto): number[] | null {
  const parciais: number[] = [];
  for (const pagamento of campos.pagamentos.slice(0, -1)) {
    const valor = parseValorCentimos(pagamento.valor);
    if (valor === null || valor <= 0) return null;
    parciais.push(valor);
  }
  return parciais;
}

/** A method chosen for more than one way of paying the same record. */
export function metodosRepetidos(pagamentos: readonly CamposPagamento[]): Set<string> {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const { metodoPagamentoId } of pagamentos) {
    if (metodoPagamentoId && vistos.has(metodoPagamentoId)) repetidos.add(metodoPagamentoId);
    vistos.add(metodoPagamentoId);
  }
  return repetidos;
}

/**
 * Enough to be worth sending: every line readable, its discount too and no
 * larger than the article, the bill's discount no larger than the bill, every
 * way of paying given a method of its own, and a split that leaves the last
 * way something. The server checks the same things, with the same functions.
 */
export function completo(campos: CamposRegisto): boolean {
  if (campos.linhas.length === 0 || campos.pagamentos.length === 0) return false;
  if (campos.pagamentos.some((pagamento) => pagamento.metodoPagamentoId === "")) return false;
  if (metodosRepetidos(campos.pagamentos).size > 0) return false;
  const parciais = parciaisDoPagamento(campos);
  if (!parciais) return false;

  const linhas: LinhaParaCalculo[] = [];
  for (const linha of campos.linhas) {
    const calculo = linhaParaCalculo(linha);
    if (!calculo || linha.descricao.trim().length < 2) return false;
    const { bruto, semDesconto } = calcularLinha(calculo);
    if (semDesconto <= 0 || semDesconto > MAX_CENTIMOS) return false;
    if (calculo.desconto?.tipo === "VALOR" && calculo.desconto.centimos > bruto) return false;
    linhas.push(calculo);
  }

  const desconto = parseDesconto(campos.desconto);
  if (desconto === "invalido") return false;
  const { subtotal, total } = calcularRegisto(linhas, desconto);
  if (desconto?.tipo === "VALOR" && desconto.centimos > subtotal) return false;
  if (parciais.length > 0 && repartirPagamento(total, parciais).resto <= 0) return false;
  return subtotal <= MAX_CENTIMOS;
}

/** One line of a record being edited, priced — only lines that read. */
export type LinhaEmEdicao = {
  id: string;
  calculo: LinhaParaCalculo;
  precos: LinhaCalculada;
};

/**
 * The record as it stands on screen, priced the way the server will price it.
 *
 * Lines whose quantity or price does not read yet are left out of the sums,
 * and a discount that does not read counts as none — each field says so on its
 * own, and the running total should not jump about while someone types "1".
 */
export function calcularEmEdicao(campos: CamposRegisto): {
  registo: RegistoCalculado;
  linhas: LinhaEmEdicao[];
  /** The same lines, by id, for the card's own columns. */
  porId: Map<string, LinhaCalculada>;
} {
  const lidas = campos.linhas.flatMap((linha) => {
    const calculo =
      linhaParaCalculo(linha) ?? linhaParaCalculo({ ...linha, desconto: "" });
    return calculo ? [{ id: linha.id, calculo }] : [];
  });

  const desconto = parseDesconto(campos.desconto);
  const registo = calcularRegisto(
    lidas.map(({ calculo }) => calculo),
    desconto === "invalido" ? null : desconto,
  );
  const linhas = lidas.map(({ id, calculo }, indice) => ({
    id,
    calculo,
    precos: registo.linhas[indice]!,
  }));
  return { registo, linhas, porId: new Map(linhas.map((linha) => [linha.id, linha.precos])) };
}

/**
 * The payments as they stand on screen, for a record whose total is `total`:
 * every way but the last for what was typed, and the last for what is left.
 *
 * An amount that does not read yet counts as nothing, and none is taken past
 * what is left of the total, so the live totals by method add up to the record
 * while someone is still typing. `resto` is the last way's share before that
 * capping: below zero when the amounts typed pass the total, which is what the
 * card warns about.
 */
export function pagamentosEmEdicao(
  pagamentos: readonly CamposPagamento[],
  total: number,
): { valores: number[]; resto: number } {
  const parciais = pagamentos
    .slice(0, -1)
    .map((pagamento) => parseValorCentimos(pagamento.valor) ?? 0);
  const { resto } = repartirPagamento(total, parciais);

  let falta = total;
  const valores = parciais.map((valor) => {
    const parte = Math.min(valor, Math.max(falta, 0));
    falta -= parte;
    return parte;
  });
  valores.push(Math.max(falta, 0));
  return { valores, resto };
}

/** What goes over the wire — `null` where the form holds "". */
export function paraEnviar(campos: CamposRegisto) {
  const opcional = (valor: string) => valor.trim() || null;
  return {
    tipo: campos.tipo,
    clienteNome: opcional(campos.clienteNome),
    clienteNif: opcional(campos.clienteNif),
    clienteInvgestId: opcional(campos.clienteInvgestId),
    facturaInvgestId: opcional(campos.facturaInvgestId),
    facturaCodigo: opcional(campos.facturaCodigo),
    nota: opcional(campos.nota),
    desconto: campos.desconto,
    pagamentos: campos.pagamentos.map((pagamento, indice, todos) => ({
      metodoPagamentoId: pagamento.metodoPagamentoId,
      // The last one is the rest: the server works it out from the lines.
      valor: indice < todos.length - 1 ? pagamento.valor : null,
    })),
    linhas: campos.linhas.map((linha) => ({
      id: linha.id,
      descricao: linha.descricao,
      quantidade: linha.quantidade,
      precoUnitario: linha.precoUnitario,
      taxaIva: linha.taxaIva,
      precoIncluiIva: linha.precoIncluiIva,
      desconto: linha.desconto,
      artigoInvgestId: opcional(linha.artigoInvgestId),
      artigoCodigo: opcional(linha.artigoCodigo),
    })),
  };
}
