import "server-only";
import { prisma } from "@/lib/db";
import { monthRange, toDia, type Periodo } from "@/lib/award/periodo";
import { vistasAtividades, type AtividadeVista } from "@/components/equipa/AtividadeCard";

/**
 * Everything the two employee screens need about one month.
 *
 * Loaded in one place because Início and Registos disagreeing about the same
 * sheet — a count on one screen that the other's list does not support — is the
 * failure this split makes possible, and a shared loader is what prevents it.
 */
export type Resumo = Awaited<ReturnType<typeof carregarMinhaFolha>>;

export type FiltroRegistos = "todas" | "validadas" | "justificacao" | "pendentes";

/** Awaiting a verdict: written or answered, not yet judged. */
const PENDENTES = new Set(["RASCUNHO", "SUBMETIDA", "JUSTIFICADA"]);

export function filtrar(atividades: AtividadeVista[], filtro: FiltroRegistos): AtividadeVista[] {
  switch (filtro) {
    case "validadas":
      return atividades.filter((a) => a.estado === "VALIDADA");
    case "justificacao":
      return atividades.filter((a) => a.estado === "EM_JUSTIFICACAO");
    case "pendentes":
      return atividades.filter((a) => PENDENTES.has(a.estado));
    default:
      return atividades;
  }
}

export async function carregarMinhaFolha(userId: string, periodo: Periodo) {
  const { start, endExclusive } = monthRange(periodo);

  const [folha, categorias, utilizador] = await Promise.all([
    prisma.folhaMensal.findUnique({
      where: { userId_periodo: { userId, periodo } },
      select: {
        id: true,
        estado: true,
        prazoSubmissao: true,
        submetidaEm: true,
        atividades: {
          orderBy: [{ dia: "desc" }, { inicioEm: "desc" }],
          select: {
            id: true,
            descricao: true,
            dia: true,
            inicioEm: true,
            fimEm: true,
            minutos: true,
            estado: true,
            notaRevisao: true,
            possivelInconsistencia: true,
            categoriaId: true,
            categoria: { select: { nome: true } },
          },
        },
      },
    }),
    prisma.categoriaAtividade.findMany({
      where: { ativo: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { cargoId: true } }),
  ]);

  const atividades = vistasAtividades(folha?.atividades ?? []);
  const validadas = atividades.filter((a) => a.estado === "VALIDADA");
  const aJustificar = atividades.filter((a) => a.estado === "EM_JUSTIFICACAO");
  const hoje = toDia(new Date());
  const ultimoDia = toDia(new Date(endExclusive.getTime() - 86_400_000));

  // A submitted or closed sheet is a record, not a workspace.
  const bloqueada = folha?.estado === "SUBMETIDA" || folha?.estado === "FECHADA";

  const prazo = folha?.prazoSubmissao ?? null;
  const diasAtePrazo = prazo
    ? Math.ceil((prazo.getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    folha,
    categorias,
    atividades,
    semCargo: !utilizador?.cargoId,
    bloqueada,
    /** Keyed by filter name so the chips and the list cannot disagree. */
    contagens: {
      todas: atividades.length,
      validadas: validadas.length,
      justificacao: aJustificar.length,
      pendentes: filtrar(atividades, "pendentes").length,
    } satisfies Record<FiltroRegistos, number>,
    minutosValidados: validadas.reduce((soma, a) => soma + a.minutos, 0),
    diasComRegisto: new Set(
      atividades.filter((a) => a.estado !== "REJEITADA").map((a) => a.dia),
    ).size,
    prazo,
    diasAtePrazo,
    /** Clamped so the form never offers a day outside the month it belongs to. */
    diaPorOmissao: hoje >= toDia(start) && hoje <= ultimoDia ? hoje : ultimoDia,
    minDia: toDia(start),
    maxDia: ultimoDia,
  };
}
