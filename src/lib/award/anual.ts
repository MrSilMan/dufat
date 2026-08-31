import "server-only";
import { prisma } from "@/lib/db";
import { ESCOPO_EMPRESA } from "@/lib/award/compute";
import { mesesDoAno } from "@/lib/award/periodo";
import { classificarAnual, type EntradaAnual, type LinhaAnual } from "@/lib/award/scoring";

/** What the annual award stores in AwardScore.componentes. */
export type ComponentesAnuais = {
  vitorias: number;
  mesesPontuados: number;
  mediaMensal: number;
  /** The months this employee was ranked in, oldest first. */
  meses: { periodo: string; posicao: number | null; pontuacao: number; venceu: boolean }[];
};

/**
 * Builds the Funcionário do Ano standings from the confirmed monthly periods.
 *
 * Only CONFIRMADO months count. A calculated-but-unconfirmed month is a
 * proposal the admin has not signed off, and letting it feed the annual award
 * would hand out a yearly prize on the strength of numbers nobody accepted.
 */
export async function classificacaoAnual(
  ano: string,
  escopo: string = ESCOPO_EMPRESA,
): Promise<LinhaAnual[]> {
  const meses = mesesDoAno(ano);

  const periodos = await prisma.awardPeriod.findMany({
    where: { tipo: "MENSAL", estado: "CONFIRMADO", escopo, periodo: { in: meses } },
    select: {
      periodo: true,
      vencedorId: true,
      scores: {
        where: { elegivel: true },
        select: {
          userId: true,
          posicao: true,
          pontuacaoTotal: true,
          user: {
            select: {
              name: true,
              cargo: { select: { nome: true } },
              departamento: { select: { id: true, nome: true } },
            },
          },
        },
      },
    },
    orderBy: { periodo: "asc" },
  });

  const porUser = new Map<string, EntradaAnual & { meses: ComponentesAnuais["meses"] }>();

  for (const periodo of periodos) {
    for (const score of periodo.scores) {
      const entrada =
        porUser.get(score.userId) ??
        {
          userId: score.userId,
          nome: score.user.name,
          cargoNome: score.user.cargo?.nome ?? null,
          departamentoId: score.user.departamento?.id ?? null,
          departamentoNome: score.user.departamento?.nome ?? null,
          vitorias: 0,
          mesesPontuados: 0,
          somaPontuacoes: 0,
          meses: [] as ComponentesAnuais["meses"],
        };

      const pontuacao = Number(score.pontuacaoTotal);
      const venceu = periodo.vencedorId === score.userId;

      entrada.mesesPontuados += 1;
      entrada.somaPontuacoes += pontuacao;
      if (venceu) entrada.vitorias += 1;
      entrada.meses.push({ periodo: periodo.periodo, posicao: score.posicao, pontuacao, venceu });

      porUser.set(score.userId, entrada);
    }
  }

  return classificarAnual([...porUser.values()]);
}

/** Calculates the annual period and stores each employee's yearly breakdown. */
export async function calcularEGuardarAnual(input: {
  ano: string;
  departamentoId?: string | null;
}): Promise<{ awardPeriodId: string; linhas: LinhaAnual[] }> {
  const departamentoId = input.departamentoId ?? null;
  const escopo = departamentoId ?? ESCOPO_EMPRESA;

  const existente = await prisma.awardPeriod.findUnique({
    where: { periodo_tipo_escopo: { periodo: input.ano, tipo: "ANUAL", escopo } },
    select: { estado: true },
  });
  if (existente?.estado === "CONFIRMADO") {
    throw new Error("O prémio anual deste ano já foi confirmado.");
  }

  const linhas = await classificacaoAnual(input.ano, escopo);
  const detalhes = new Map<string, ComponentesAnuais["meses"]>();
  for (const linha of linhas) {
    detalhes.set(linha.userId, (linha as LinhaAnual & { meses?: ComponentesAnuais["meses"] }).meses ?? []);
  }

  const awardPeriodId = await prisma.$transaction(async (tx) => {
    const period = await tx.awardPeriod.upsert({
      where: { periodo_tipo_escopo: { periodo: input.ano, tipo: "ANUAL", escopo } },
      create: {
        periodo: input.ano,
        tipo: "ANUAL",
        departamentoId,
        escopo,
        estado: "CALCULADO",
        propostoId: linhas[0]?.userId ?? null,
        parametros: { criterio: "vitorias_depois_media" },
      },
      update: {
        propostoId: linhas[0]?.userId ?? null,
        calculadoEm: new Date(),
        vencedorId: null,
        pontuacaoVencedor: null,
        motivoOverride: null,
      },
      select: { id: true },
    });

    await tx.awardScore.deleteMany({ where: { awardPeriodId: period.id } });
    await tx.awardScore.createMany({
      data: linhas.map((linha) => ({
        awardPeriodId: period.id,
        userId: linha.userId,
        posicao: linha.posicao,
        // The annual "score" is the average monthly score; wins are the primary
        // ranking key and live in the breakdown.
        pontuacaoTotal: linha.mediaMensal,
        componentes: {
          vitorias: linha.vitorias,
          mesesPontuados: linha.mesesPontuados,
          mediaMensal: linha.mediaMensal,
          meses: detalhes.get(linha.userId) ?? [],
        } satisfies ComponentesAnuais as unknown as object,
        penalizacoes: [],
        elegivel: true,
      })),
    });

    return period.id;
  });

  return { awardPeriodId, linhas };
}
