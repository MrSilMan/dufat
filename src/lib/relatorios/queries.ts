import "server-only";
import type { Prisma, TipoDesconto } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dateParaDia, diaParaDate, hojeLuanda, isDia } from "@/lib/relatorios/dia";
import type { Desconto } from "@/lib/relatorios/dinheiro";
import type {
  EstadoRelatorio,
  LinhaVista,
  RegistoVista,
  TipoLinha,
} from "@/lib/relatorios/resumo";

/** The two columns a discount is stored in, read back as one value. */
export function descontoDasColunas(
  tipo: TipoDesconto | null,
  valor: bigint | null,
): Desconto | null {
  if (tipo === null || valor === null) return null;
  return tipo === "PERCENTAGEM"
    ? { tipo, centesimos: Number(valor) }
    : { tipo, centimos: Number(valor) };
}

/** A discount as its two columns hold it; both null when there is none. */
export function colunasDoDesconto(desconto: Desconto | null): {
  descontoTipo: TipoDesconto | null;
  descontoValor: bigint | null;
} {
  if (!desconto) return { descontoTipo: null, descontoValor: null };
  return {
    descontoTipo: desconto.tipo,
    descontoValor: BigInt(
      desconto.tipo === "PERCENTAGEM" ? desconto.centesimos : desconto.centimos,
    ),
  };
}

/** BigInt does not cross the server/client boundary as a plain number. */
export function vistaLinha(linha: {
  id: string;
  tipo: TipoLinha;
  descricao: string;
  quantidadeMil: number;
  precoUnitarioCentimos: bigint;
  taxaIvaCentesimos: number;
  precoIncluiIva: boolean;
  descontoTipo: TipoDesconto | null;
  descontoValor: bigint | null;
  descontoCentimos: bigint;
  descontoRegistoCentimos: bigint;
  valorCentimos: bigint;
  artigoInvgestId: string | null;
  artigoCodigo: string | null;
  ordem: number;
}): LinhaVista {
  return {
    id: linha.id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    quantidadeMil: linha.quantidadeMil,
    precoUnitarioCentimos: Number(linha.precoUnitarioCentimos),
    taxaIvaCentesimos: linha.taxaIvaCentesimos,
    precoIncluiIva: linha.precoIncluiIva,
    desconto: descontoDasColunas(linha.descontoTipo, linha.descontoValor),
    descontoCentimos: Number(linha.descontoCentimos),
    descontoRegistoCentimos: Number(linha.descontoRegistoCentimos),
    valorCentimos: Number(linha.valorCentimos),
    artigoInvgestId: linha.artigoInvgestId,
    artigoCodigo: linha.artigoCodigo,
    ordem: linha.ordem,
  };
}

export const SELECT_LINHA = {
  id: true,
  tipo: true,
  descricao: true,
  quantidadeMil: true,
  precoUnitarioCentimos: true,
  taxaIvaCentesimos: true,
  precoIncluiIva: true,
  descontoTipo: true,
  descontoValor: true,
  descontoCentimos: true,
  descontoRegistoCentimos: true,
  valorCentimos: true,
  artigoInvgestId: true,
  artigoCodigo: true,
  ordem: true,
} as const;

export const SELECT_PAGAMENTO = {
  metodoPagamentoId: true,
  metodoPagamentoNome: true,
  valorCentimos: true,
} as const;

export const SELECT_REGISTO = {
  id: true,
  tipo: true,
  clienteNome: true,
  clienteNif: true,
  clienteInvgestId: true,
  facturaInvgestId: true,
  facturaCodigo: true,
  nota: true,
  descontoTipo: true,
  descontoValor: true,
  versao: true,
  linhas: { orderBy: { ordem: "asc" }, select: SELECT_LINHA },
  pagamentos: { orderBy: { ordem: "asc" }, select: SELECT_PAGAMENTO },
} as const;

export function vistaRegisto(registo: {
  id: string;
  tipo: TipoLinha;
  clienteNome: string | null;
  clienteNif: string | null;
  clienteInvgestId: string | null;
  facturaInvgestId: string | null;
  facturaCodigo: string | null;
  nota: string | null;
  descontoTipo: TipoDesconto | null;
  descontoValor: bigint | null;
  versao: number;
  linhas: Parameters<typeof vistaLinha>[0][];
  pagamentos: { metodoPagamentoId: string; metodoPagamentoNome: string; valorCentimos: bigint }[];
}): RegistoVista {
  return {
    id: registo.id,
    tipo: registo.tipo,
    clienteNome: registo.clienteNome,
    clienteNif: registo.clienteNif,
    clienteInvgestId: registo.clienteInvgestId,
    facturaInvgestId: registo.facturaInvgestId,
    facturaCodigo: registo.facturaCodigo,
    nota: registo.nota,
    desconto: descontoDasColunas(registo.descontoTipo, registo.descontoValor),
    versao: registo.versao,
    linhas: registo.linhas.map(vistaLinha),
    pagamentos: registo.pagamentos.map((pagamento) => ({
      metodoPagamentoId: pagamento.metodoPagamentoId,
      metodoPagamentoNome: pagamento.metodoPagamentoNome,
      valorCentimos: Number(pagamento.valorCentimos),
    })),
  };
}

/**
 * One report with everything its screens, print and CSV show.
 *
 * A deleted report reads as not found unless `incluirApagado` is passed — for
 * the few screens that deal with it as such (the admin's, which can restore
 * it; its author's, which says it is gone).
 */
export async function carregarRelatorio(
  id: string,
  { incluirApagado = false }: { incluirApagado?: boolean } = {},
) {
  const relatorio = await prisma.relatorioDiario.findUnique({
    where: { id },
    select: {
      id: true,
      dia: true,
      estado: true,
      versao: true,
      finalizadoEm: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      apagadoEm: true,
      motivoApagado: true,
      apagadoPor: { select: { name: true } },
      user: { select: { name: true, email: true } },
      finalizadoPor: { select: { name: true } },
      registos: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: SELECT_REGISTO,
      },
    },
  });
  if (!relatorio || (relatorio.apagadoEm && !incluirApagado)) return null;

  return {
    id: relatorio.id,
    dia: dateParaDia(relatorio.dia),
    estado: relatorio.estado as EstadoRelatorio,
    versao: relatorio.versao,
    finalizadoEm: relatorio.finalizadoEm,
    finalizadoPorNome: relatorio.finalizadoPor?.name ?? null,
    createdAt: relatorio.createdAt,
    updatedAt: relatorio.updatedAt,
    autorId: relatorio.userId,
    autorNome: relatorio.user.name,
    autorEmail: relatorio.user.email,
    /** Null for a report in use. */
    apagado: relatorio.apagadoEm
      ? {
          em: relatorio.apagadoEm,
          porNome: relatorio.apagadoPor?.name ?? null,
          motivo: relatorio.motivoApagado,
        }
      : null,
    /** In entry order, each with its lines and its payments — what the totals read. */
    registos: relatorio.registos.map(vistaRegisto),
  };
}

export type RelatorioCarregado = NonNullable<Awaited<ReturnType<typeof carregarRelatorio>>>;

/** What the picker offers for new records: active methods only. */
export async function metodosAtivos() {
  return prisma.metodoPagamento.findMany({
    where: { ativo: true },
    orderBy: [{ sortOrder: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true },
  });
}

export type TotaisLista = { vendas: number; despesas: number; linhas: number };

/** Sales/expense sums for many reports in one grouped query, for list screens. */
export async function totaisPorRelatorio(ids: string[]): Promise<Map<string, TotaisLista>> {
  const totais = new Map<string, TotaisLista>();
  if (ids.length === 0) return totais;

  const grupos = await prisma.linhaRelatorio.groupBy({
    by: ["relatorioId", "tipo"],
    where: { relatorioId: { in: ids } },
    _sum: { valorCentimos: true },
    _count: { _all: true },
  });

  for (const grupo of grupos) {
    const atual = totais.get(grupo.relatorioId) ?? { vendas: 0, despesas: 0, linhas: 0 };
    const soma = Number(grupo._sum.valorCentimos ?? 0n);
    if (grupo.tipo === "VENDA") atual.vendas += soma;
    else atual.despesas += soma;
    atual.linhas += grupo._count._all;
    totais.set(grupo.relatorioId, atual);
  }
  return totais;
}

/** Every change to one report, newest first. */
export async function carregarHistorico(relatorioId: string) {
  return prisma.relatorioHistorico.findMany({
    where: { relatorioId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      acao: true,
      antes: true,
      depois: true,
      nota: true,
      userName: true,
      createdAt: true,
    },
  });
}

const LIMITE_LISTA = 200;

export type FiltrosRelatorios = {
  colaborador?: string;
  estado?: string;
  desde?: string;
  ate?: string;
};

/** The `estado` filter value that lists deleted reports instead — admin only. */
export const ESTADO_APAGADO = "APAGADO";

/**
 * Everyone's reports for a date range, with totals — the admin's list and the
 * read-only one granted viewers get are the same query.
 *
 * Deleted reports are left out. The admin alone can list them, by asking for
 * `estado` "APAGADO" with `apagados` set; anyone else asking gets the default.
 *
 * Defaults to the thirty days up to today in Luanda; unparseable filters fall
 * back to the defaults rather than erroring on a hand-edited URL.
 */
export async function listarRelatorios(
  params: FiltrosRelatorios,
  { apagados = false }: { apagados?: boolean } = {},
) {
  const hoje = hojeLuanda();
  const ate = params.ate && isDia(params.ate) ? params.ate : hoje;
  let desde = params.desde && isDia(params.desde) ? params.desde : undefined;
  if (!desde) {
    const inicio = diaParaDate(ate);
    inicio.setUTCDate(inicio.getUTCDate() - 30);
    desde = dateParaDia(inicio);
  }
  const estado =
    params.estado === "RASCUNHO" ||
    params.estado === "FINALIZADO" ||
    (apagados && params.estado === ESTADO_APAGADO)
      ? params.estado
      : undefined;
  const colaborador = params.colaborador || undefined;

  const where: Prisma.RelatorioDiarioWhereInput = {
    dia: { gte: diaParaDate(desde), lte: diaParaDate(ate) },
    ...(estado === ESTADO_APAGADO
      ? { apagadoEm: { not: null } }
      : { apagadoEm: null, ...(estado ? { estado } : {}) }),
    ...(colaborador ? { userId: colaborador } : {}),
  };

  const [relatorios, autores] = await Promise.all([
    prisma.relatorioDiario.findMany({
      where,
      orderBy: [{ dia: "desc" }, { user: { name: "asc" } }],
      take: LIMITE_LISTA,
      select: {
        id: true,
        dia: true,
        estado: true,
        updatedAt: true,
        apagadoEm: true,
        user: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { relatorios: { some: apagados ? {} : { apagadoEm: null } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const totais = await totaisPorRelatorio(relatorios.map((r) => r.id));

  return {
    filtros: { colaborador, estado, desde, ate, hoje },
    relatorios: relatorios.map((r) => ({
      id: r.id,
      dia: dateParaDia(r.dia),
      estado: r.estado as EstadoRelatorio,
      updatedAt: r.updatedAt,
      apagadoEm: r.apagadoEm,
      autorNome: r.user.name,
      totais: totais.get(r.id) ?? { vendas: 0, despesas: 0, linhas: 0 },
    })),
    autores,
    truncado: relatorios.length === LIMITE_LISTA,
  };
}

export type ListaRelatoriosDados = Awaited<ReturnType<typeof listarRelatorios>>;
