import {
  centimosParaTexto,
  parseQuantidadeMil,
  parseValorCentimos,
  quantidadeMilParaTexto,
  totalDaLinha,
  MAX_CENTIMOS,
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
   * IVA in hundredths of a percent (1400 = 14%). Not typed — a line filled in
   * from an INVGEST document carries the document's rate, and a line written
   * by hand keeps 0, its price being what was paid.
   */
  taxaIva: number;
  artigoInvgestId: string;
  artigoCodigo: string;
};

export type CamposRegisto = {
  tipo: TipoLinha;
  clienteNome: string;
  clienteNif: string;
  clienteInvgestId: string;
  facturaInvgestId: string;
  facturaCodigo: string;
  nota: string;
  metodoPagamentoId: string;
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
  /** Keyed by field, and `linhas.<id>.<campo>` for a line's own. */
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

export function linhaVazia(): CamposLinha {
  return {
    id: novoId(),
    descricao: "",
    quantidade: "1",
    precoUnitario: "",
    taxaIva: 0,
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
    metodoPagamentoId,
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
    metodoPagamentoId: registo.metodoPagamentoId,
    linhas: registo.linhas.map((linha) => ({
      id: linha.id,
      descricao: linha.descricao,
      quantidade: quantidadeMilParaTexto(linha.quantidadeMil),
      precoUnitario: centimosParaTexto(linha.precoUnitarioCentimos),
      taxaIva: linha.taxaIvaCentesimos,
      artigoInvgestId: linha.artigoInvgestId ?? "",
      artigoCodigo: linha.artigoCodigo ?? "",
    })),
  };
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
    campos.metodoPagamentoId !== base.metodoPagamentoId ||
    campos.linhas.length !== base.linhas.length
  ) {
    return false;
  }

  return campos.linhas.every((linha, indice) => {
    const guardada = base.linhas[indice]!;
    return (
      linha.id === guardada.id &&
      linha.descricao.trim() === guardada.descricao &&
      parseQuantidadeMil(linha.quantidade) === guardada.quantidadeMil &&
      parseValorCentimos(linha.precoUnitario) === guardada.precoUnitarioCentimos &&
      linha.taxaIva === guardada.taxaIvaCentesimos &&
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
    campos.linhas.every((linha) => !linha.descricao.trim() && !linha.precoUnitario.trim())
  );
}

function linhaCompleta(linha: CamposLinha): boolean {
  const quantidade = parseQuantidadeMil(linha.quantidade);
  const preco = parseValorCentimos(linha.precoUnitario);
  if (linha.descricao.trim().length < 2 || quantidade === null || preco === null || preco <= 0) {
    return false;
  }
  const total = totalDaLinha(quantidade, preco, linha.taxaIva);
  return total > 0 && total <= MAX_CENTIMOS;
}

/** Enough to be worth sending: every line readable, and a method chosen. */
export function completo(campos: CamposRegisto): boolean {
  return (
    campos.metodoPagamentoId !== "" &&
    campos.linhas.length > 0 &&
    campos.linhas.every(linhaCompleta)
  );
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
    metodoPagamentoId: campos.metodoPagamentoId,
    linhas: campos.linhas.map((linha) => ({
      id: linha.id,
      descricao: linha.descricao,
      quantidade: linha.quantidade,
      precoUnitario: linha.precoUnitario,
      taxaIva: linha.taxaIva,
      artigoInvgestId: opcional(linha.artigoInvgestId),
      artigoCodigo: opcional(linha.artigoCodigo),
    })),
  };
}
