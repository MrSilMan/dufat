import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dateParaDia, diaParaDate, hojeLuanda, isDia } from "@/lib/relatorios/dia";
import type {
  EstadoRelatorio,
  LinhaVista,
  RegistoVista,
  TipoLinha,
} from "@/lib/relatorios/resumo";

/** BigInt does not cross the server/client boundary as a plain number. */
export function vistaLinha(linha: {
  id: string;
  tipo: TipoLinha;
  descricao: string;
  quantidadeMil: number;
  precoUnitarioCentimos: bigint;
  taxaIvaCentesimos: number;
  valorCentimos: bigint;
  artigoInvgestId: string | null;
  artigoCodigo: string | null;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  ordem: number;
}): LinhaVista {
  return {
    id: linha.id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    quantidadeMil: linha.quantidadeMil,
    precoUnitarioCentimos: Number(linha.precoUnitarioCentimos),
    taxaIvaCentesimos: linha.taxaIvaCentesimos,
    valorCentimos: Number(linha.valorCentimos),
    artigoInvgestId: linha.artigoInvgestId,
    artigoCodigo: linha.artigoCodigo,
    metodoPagamentoId: linha.metodoPagamentoId,
    metodoPagamentoNome: linha.metodoPagamentoNome,
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
  valorCentimos: true,
  artigoInvgestId: true,
  artigoCodigo: true,
  metodoPagamentoId: true,
  metodoPagamentoNome: true,
  ordem: true,
} as const;

export const SELECT_REGISTO = {
  id: true,
  tipo: true,
  clienteNome: true,
  clienteNif: true,
  clienteInvgestId: true,
  facturaInvgestId: true,
  facturaCodigo: true,
  metodoPagamentoId: true,
  metodoPagamentoNome: true,
  nota: true,
  versao: true,
  linhas: { orderBy: { ordem: "asc" }, select: SELECT_LINHA },
} as const;

export function vistaRegisto(registo: {
  id: string;
  tipo: TipoLinha;
  clienteNome: string | null;
  clienteNif: string | null;
  clienteInvgestId: string | null;
  facturaInvgestId: string | null;
  facturaCodigo: string | null;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  nota: string | null;
  versao: number;
  linhas: Parameters<typeof vistaLinha>[0][];
}): RegistoVista {
  return {
    id: registo.id,
    tipo: registo.tipo,
    clienteNome: registo.clienteNome,
    clienteNif: registo.clienteNif,
    clienteInvgestId: registo.clienteInvgestId,
    facturaInvgestId: registo.facturaInvgestId,
    facturaCodigo: registo.facturaCodigo,
    metodoPagamentoId: registo.metodoPagamentoId,
    metodoPagamentoNome: registo.metodoPagamentoNome,
    nota: registo.nota,
    versao: registo.versao,
    linhas: registo.linhas.map(vistaLinha),
  };
}

/** One report with everything its screens, print and CSV show. */
export async function carregarRelatorio(id: string) {
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
      user: { select: { name: true, email: true } },
      finalizadoPor: { select: { name: true } },
      registos: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: SELECT_REGISTO,
      },
      linhas: { orderBy: { createdAt: "asc" }, select: SELECT_LINHA },
    },
  });
  if (!relatorio) return null;

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
    registos: relatorio.registos.map(vistaRegisto),
    /** Every line, flat and in entry order — what the totals and CSV read. */
    linhas: relatorio.linhas.map(vistaLinha),
  };
}

export type RelatorioCarregado = NonNullable<Awaited<ReturnType<typeof carregarRelatorio>>>;

/** What the picker offers for new lines: active methods only. */
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

/**
 * Everyone's reports for a date range, with totals — the admin's list and the
 * read-only one granted viewers get are the same query.
 *
 * Defaults to the thirty days up to today in Luanda; unparseable filters fall
 * back to the defaults rather than erroring on a hand-edited URL.
 */
export async function listarRelatorios(params: FiltrosRelatorios) {
  const hoje = hojeLuanda();
  const ate = params.ate && isDia(params.ate) ? params.ate : hoje;
  let desde = params.desde && isDia(params.desde) ? params.desde : undefined;
  if (!desde) {
    const inicio = diaParaDate(ate);
    inicio.setUTCDate(inicio.getUTCDate() - 30);
    desde = dateParaDia(inicio);
  }
  const estado =
    params.estado === "RASCUNHO" || params.estado === "FINALIZADO" ? params.estado : undefined;
  const colaborador = params.colaborador || undefined;

  const where: Prisma.RelatorioDiarioWhereInput = {
    dia: { gte: diaParaDate(desde), lte: diaParaDate(ate) },
    ...(estado ? { estado } : {}),
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
        user: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { relatorios: { some: {} } },
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
      autorNome: r.user.name,
      totais: totais.get(r.id) ?? { vendas: 0, despesas: 0, linhas: 0 },
    })),
    autores,
    truncado: relatorios.length === LIMITE_LISTA,
  };
}

export type ListaRelatoriosDados = Awaited<ReturnType<typeof listarRelatorios>>;
