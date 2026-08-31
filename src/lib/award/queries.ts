import "server-only";
import { prisma } from "@/lib/db";
import { periodoAtual, type Periodo } from "@/lib/award/periodo";

/**
 * Months worth offering in the period picker, newest first.
 *
 * Drawn from the sheets and calculated periods that actually exist, plus the
 * current month, so the picker never offers an empty month nor hides the one
 * the admin is most likely to want.
 */
export async function periodosDisponiveis(): Promise<Periodo[]> {
  const [folhas, periodos] = await Promise.all([
    prisma.folhaMensal.findMany({
      distinct: ["periodo"],
      select: { periodo: true },
      orderBy: { periodo: "desc" },
      take: 36,
    }),
    prisma.awardPeriod.findMany({
      where: { tipo: "MENSAL" },
      distinct: ["periodo"],
      select: { periodo: true },
      orderBy: { periodo: "desc" },
      take: 36,
    }),
  ]);

  const todos = new Set<string>([
    periodoAtual(),
    ...folhas.map((f) => f.periodo),
    ...periodos.map((p) => p.periodo),
  ]);
  return [...todos].sort((a, b) => b.localeCompare(a));
}

/** Every confirmed award, newest first — the history screen. */
export async function historicoPremios() {
  return prisma.awardPeriod.findMany({
    where: { estado: "CONFIRMADO" },
    orderBy: [{ periodo: "desc" }, { tipo: "asc" }],
    select: {
      id: true,
      periodo: true,
      tipo: true,
      escopo: true,
      pontuacaoVencedor: true,
      confirmadoEm: true,
      notaConfirmacao: true,
      motivoOverride: true,
      departamento: { select: { nome: true } },
      vencedor: {
        select: { id: true, name: true, photoUrl: true, cargo: { select: { nome: true } } },
      },
      confirmadoPor: { select: { name: true } },
    },
  });
}

/**
 * The confirmed award an employee is allowed to see for a period.
 *
 * Nothing about a period is visible to employees until it is confirmed —
 * publishing a live leaderboard mid-month turns the sheet into a scoreboard and
 * people start logging for the score instead of logging what they did.
 */
export async function premioVisivelParaColaborador(userId: string, periodo: string) {
  return prisma.awardPeriod.findFirst({
    where: {
      periodo,
      tipo: "MENSAL",
      estado: "CONFIRMADO",
      scores: { some: { userId } },
    },
    select: {
      id: true,
      periodo: true,
      estado: true,
      vencedor: { select: { id: true, name: true, cargo: { select: { nome: true } } } },
      scores: {
        where: { userId },
        select: {
          posicao: true,
          pontuacaoTotal: true,
          componentes: true,
          penalizacoes: true,
          elegivel: true,
          motivoInelegibilidade: true,
        },
      },
      _count: { select: { scores: { where: { elegivel: true } } } },
    },
  });
}

/**
 * Every confirmed period this employee was scored in, newest first.
 *
 * Confirmed only, and scoped to their own row — the employee area must never be
 * able to surface a colleague's score, so the filter lives in the query rather
 * than in the page that renders it.
 */
export async function meusPremios(userId: string) {
  const periodos = await prisma.awardPeriod.findMany({
    where: { tipo: "MENSAL", estado: "CONFIRMADO", scores: { some: { userId } } },
    orderBy: { periodo: "desc" },
    take: 24,
    select: {
      id: true,
      periodo: true,
      vencedorId: true,
      vencedor: { select: { name: true, cargo: { select: { nome: true } } } },
      scores: {
        where: { userId },
        select: {
          posicao: true,
          pontuacaoTotal: true,
          componentes: true,
          penalizacoes: true,
          elegivel: true,
          motivoInelegibilidade: true,
        },
      },
      _count: { select: { scores: { where: { elegivel: true } } } },
    },
  });

  return periodos
    .filter((p) => p.scores.length > 0)
    .map((p) => ({
      id: p.id,
      periodo: p.periodo,
      venceu: p.vencedorId === userId,
      vencedorNome: p.vencedor?.name ?? null,
      vencedorCargo: p.vencedor?.cargo?.nome ?? null,
      totalElegiveis: p._count.scores,
      score: p.scores[0]!,
    }));
}
