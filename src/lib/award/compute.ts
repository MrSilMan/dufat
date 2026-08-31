import "server-only";
import { prisma } from "@/lib/db";
import { getAwardParametros } from "@/lib/award/settings";
import {
  diasEsperados,
  diasUteisNoMes,
  monthRange,
  periodoAnterior,
  toDia,
  type Periodo,
} from "@/lib/award/periodo";
import { calcularRanking, mediana, type MedianasHistoricas } from "@/lib/award/scoring";
import type {
  AtividadeInput,
  AwardParametros,
  ColaboradorInput,
  Componentes,
  Penalizacao,
  Ranking,
  ScoreColaborador,
} from "@/lib/award/types";

/** Company-wide periods are stored with this sentinel scope — see AwardPeriod.escopo. */
export const ESCOPO_EMPRESA = "EMPRESA";

/** Minutes past midnight, read in UTC to match how sheet times are written. */
function minutosDoDia(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * Median volume and hours per cargo across previously *confirmed* months.
 *
 * Used when a cargo has too few people this month to have a meaningful median
 * of its own. Only confirmed periods count, so an unreviewed calculation can
 * never quietly become the yardstick everyone else is measured by.
 */
export async function medianasHistoricas(anteriorA: Periodo): Promise<MedianasHistoricas> {
  const rows = await prisma.awardScore.findMany({
    where: {
      elegivel: true,
      awardPeriod: { tipo: "MENSAL", estado: "CONFIRMADO", periodo: { lt: anteriorA } },
      user: { cargoId: { not: null } },
    },
    select: { componentes: true, user: { select: { cargoId: true } } },
  });

  const porCargo = new Map<string, { volumes: number[]; horas: number[] }>();
  for (const row of rows) {
    const cargoId = row.user.cargoId;
    if (!cargoId) continue;
    const comp = row.componentes as unknown as Componentes | null;
    if (!comp?.volume || !comp?.horas) continue;
    const bucket = porCargo.get(cargoId) ?? { volumes: [], horas: [] };
    bucket.volumes.push(comp.volume.bruto);
    bucket.horas.push(comp.horas.bruto);
    porCargo.set(cargoId, bucket);
  }

  const out: MedianasHistoricas = new Map();
  for (const [cargoId, bucket] of porCargo) {
    out.set(cargoId, { volume: mediana(bucket.volumes), horas: mediana(bucket.horas) });
  }
  return out;
}

/**
 * Everyone the award can consider for a month.
 *
 * An "employee" is an active account with a cargo — that is what makes someone
 * scoreable. A catalogue editor with no cargo is a user of the CMS, not a
 * participant in the award, and should not appear in the ranking at all.
 */
export async function carregarColaboradores(
  periodo: Periodo,
  departamentoId?: string | null,
): Promise<ColaboradorInput[]> {
  const { start, endExclusive } = monthRange(periodo);
  const anterior = periodoAnterior(periodo);

  const [users, vencedoresAnteriores] = await Promise.all([
    prisma.user.findMany({
      where: {
        active: true,
        cargoId: { not: null },
        ...(departamentoId ? { departamentoId } : {}),
        // Someone who left before the month started, or joined after it ended,
        // was never in it.
        OR: [{ dataSaida: null }, { dataSaida: { gte: start } }],
        AND: [{ OR: [{ dataAdmissao: null }, { dataAdmissao: { lt: endExclusive } }] }],
      },
      select: {
        id: true,
        name: true,
        diasSemana: true,
        dataAdmissao: true,
        dataSaida: true,
        cargo: { select: { id: true, nome: true, diasSemana: true } },
        departamento: { select: { id: true, nome: true } },
        ausencias: {
          where: { aprovada: true, inicio: { lt: endExclusive }, fim: { gte: start } },
          select: { inicio: true, fim: true },
        },
        folhas: {
          where: { periodo },
          select: { estado: true, submetidaEm: true, prazoSubmissao: true },
        },
        atividades: {
          where: { dia: { gte: start, lt: endExclusive } },
          select: {
            id: true,
            categoriaId: true,
            dia: true,
            inicioEm: true,
            fimEm: true,
            minutos: true,
            estado: true,
            possivelInconsistencia: true,
            jaQuestionada: true,
            registadaEm: true,
            categoria: { select: { isOutro: true } },
          },
        },
      },
    }),
    prisma.awardPeriod.findMany({
      where: { periodo: anterior, tipo: "MENSAL", estado: "CONFIRMADO" },
      select: { vencedorId: true },
    }),
  ]);

  const venceramAntes = new Set(
    vencedoresAnteriores.map((p) => p.vencedorId).filter((id): id is string => Boolean(id)),
  );

  const diasUteis = diasUteisNoMes(periodo);

  return users.map((user) => {
    const folha = user.folhas[0] ?? null;
    const semana = user.diasSemana ?? user.cargo?.diasSemana ?? 5;

    const esperados = diasEsperados({
      periodo,
      diasSemana: semana,
      dataAdmissao: user.dataAdmissao ? toDia(user.dataAdmissao) : null,
      dataSaida: user.dataSaida ? toDia(user.dataSaida) : null,
      ausencias: user.ausencias.map((a) => ({ inicio: toDia(a.inicio), fim: toDia(a.fim) })),
    });

    const atividades: AtividadeInput[] = user.atividades.map((a) => ({
      id: a.id,
      categoriaId: a.categoriaId,
      isOutro: a.categoria.isOutro,
      dia: toDia(a.dia),
      inicioMin: minutosDoDia(a.inicioEm),
      fimMin: minutosDoDia(a.fimEm),
      minutos: a.minutos,
      estado: a.estado,
      possivelInconsistencia: a.possivelInconsistencia,
      jaQuestionada: a.jaQuestionada,
      registadaEmDia: toDia(a.registadaEm),
    }));

    return {
      userId: user.id,
      nome: user.name,
      cargoId: user.cargo?.id ?? null,
      cargoNome: user.cargo?.nome ?? null,
      departamentoId: user.departamento?.id ?? null,
      departamentoNome: user.departamento?.nome ?? null,
      // A month with no working days at all (a full month of approved leave)
      // would divide by zero in consistency; the engine guards, but keeping the
      // figure honest here means the detail screen shows 0, not 22.
      diasEsperados: Math.min(esperados, Math.max(diasUteis, esperados)),
      folhaEstado: folha?.estado ?? null,
      folhaSubmetidaEm: folha?.submetidaEm ? toDia(folha.submetidaEm) : null,
      folhaPrazo: folha?.prazoSubmissao ? toDia(folha.prazoSubmissao) : null,
      venceuPeriodoAnterior: venceramAntes.has(user.id),
      atividades,
    };
  });
}

/** Computes the ranking for a month without writing anything. */
export async function simularRanking(
  periodo: Periodo,
  departamentoId?: string | null,
  parametrosOverride?: AwardParametros,
): Promise<Ranking> {
  const parametros = parametrosOverride ?? (await getAwardParametros());
  const [colaboradores, historicas] = await Promise.all([
    carregarColaboradores(periodo, departamentoId),
    medianasHistoricas(periodo),
  ]);
  return calcularRanking({
    periodo,
    colaboradores,
    parametros,
    diasUteisMes: diasUteisNoMes(periodo),
    historicas,
  });
}

export class PeriodoConfirmadoError extends Error {
  constructor() {
    super("Este período já foi confirmado e está fechado. Reabra-o antes de recalcular.");
    this.name = "PeriodoConfirmadoError";
  }
}

/**
 * Calculates a monthly period and stores every employee's breakdown.
 *
 * Refuses to touch a CONFIRMADO period: once an award has been announced the
 * numbers behind it are a matter of record, and a recalculation months later —
 * after activities have been edited or the weights retuned — would rewrite
 * history and could even change who is shown as having won.
 */
export async function calcularEGuardarPeriodo(input: {
  periodo: Periodo;
  departamentoId?: string | null;
}): Promise<{ awardPeriodId: string; ranking: Ranking }> {
  const departamentoId = input.departamentoId ?? null;
  const escopo = departamentoId ?? ESCOPO_EMPRESA;

  const existente = await prisma.awardPeriod.findUnique({
    where: { periodo_tipo_escopo: { periodo: input.periodo, tipo: "MENSAL", escopo } },
    select: { id: true, estado: true },
  });
  if (existente?.estado === "CONFIRMADO") throw new PeriodoConfirmadoError();

  const parametros = await getAwardParametros();
  const ranking = await simularRanking(input.periodo, departamentoId, parametros);

  const awardPeriodId = await prisma.$transaction(async (tx) => {
    const period = await tx.awardPeriod.upsert({
      where: { periodo_tipo_escopo: { periodo: input.periodo, tipo: "MENSAL", escopo } },
      create: {
        periodo: input.periodo,
        tipo: "MENSAL",
        departamentoId,
        escopo,
        estado: "CALCULADO",
        propostoId: ranking.proposto?.userId ?? null,
        parametros: parametros as unknown as object,
        calculadoEm: new Date(),
      },
      update: {
        propostoId: ranking.proposto?.userId ?? null,
        parametros: parametros as unknown as object,
        calculadoEm: new Date(),
        // A recalculation supersedes the previous proposal entirely.
        vencedorId: null,
        pontuacaoVencedor: null,
        motivoOverride: null,
      },
      select: { id: true },
    });

    await tx.awardScore.deleteMany({ where: { awardPeriodId: period.id } });
    await tx.awardScore.createMany({
      data: [...ranking.elegiveis, ...ranking.naoElegiveis].map((s) => ({
        awardPeriodId: period.id,
        userId: s.userId,
        posicao: s.posicao,
        pontuacaoTotal: s.pontuacaoTotal,
        componentes: s.componentes as unknown as object,
        penalizacoes: s.penalizacoes as unknown as object,
        elegivel: s.elegivel,
        motivoInelegibilidade: s.motivoInelegibilidade,
      })),
    });

    return period.id;
  });

  return { awardPeriodId, ranking };
}

export type ScoreGuardado = ScoreColaborador & { awardScoreId: string };

/**
 * Reads a stored period back.
 *
 * The ranking screen renders *this*, never a fresh calculation, so what the
 * admin confirms is exactly what was computed — and stays readable months later
 * even if activities or weights have moved since.
 */
export async function carregarPeriodoGuardado(
  periodo: string,
  tipo: "MENSAL" | "ANUAL" = "MENSAL",
  escopo: string = ESCOPO_EMPRESA,
) {
  const period = await prisma.awardPeriod.findUnique({
    where: { periodo_tipo_escopo: { periodo, tipo, escopo } },
    include: {
      departamento: { select: { id: true, nome: true } },
      vencedor: { select: { id: true, name: true, photoUrl: true } },
      confirmadoPor: { select: { name: true } },
      scores: {
        orderBy: [{ posicao: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoUrl: true,
              cargo: { select: { id: true, nome: true } },
              departamento: { select: { id: true, nome: true } },
            },
          },
        },
      },
    },
  });
  if (!period) return null;

  const linhas = period.scores.map((s) => ({
    awardScoreId: s.id,
    userId: s.userId,
    nome: s.user.name,
    email: s.user.email,
    photoUrl: s.user.photoUrl,
    cargoNome: s.user.cargo?.nome ?? null,
    departamentoNome: s.user.departamento?.nome ?? null,
    posicao: s.posicao,
    pontuacaoTotal: Number(s.pontuacaoTotal),
    componentes: s.componentes as unknown as Componentes,
    penalizacoes: (s.penalizacoes as unknown as Penalizacao[]) ?? [],
    elegivel: s.elegivel,
    motivoInelegibilidade: s.motivoInelegibilidade,
  }));

  return {
    period,
    parametros: period.parametros as unknown as AwardParametros,
    elegiveis: linhas
      .filter((l) => l.elegivel)
      .sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999)),
    naoElegiveis: linhas
      .filter((l) => !l.elegivel)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
  };
}

export type PeriodoGuardado = NonNullable<Awaited<ReturnType<typeof carregarPeriodoGuardado>>>;
export type LinhaRanking = PeriodoGuardado["elegiveis"][number];
