import type { Dia, Periodo } from "@/lib/award/periodo";

export type EstadoAtividade =
  | "RASCUNHO"
  | "SUBMETIDA"
  | "VALIDADA"
  | "EM_JUSTIFICACAO"
  | "JUSTIFICADA"
  | "REJEITADA";

export type EstadoFolha = "ABERTA" | "SUBMETIDA" | "FECHADA";

/**
 * Claimed by the employee, not yet judged by a reviewer.
 *
 * Deliberately excludes RASCUNHO: a draft is not waiting on RH, it is waiting
 * on its author. The employee screens have their own, wider notion of
 * "pendente" that does include drafts — the two must not be merged.
 */
export const POR_REVER: ReadonlySet<EstadoAtividade> = new Set<EstadoAtividade>([
  "SUBMETIDA",
  "EM_JUSTIFICACAO",
  "JUSTIFICADA",
]);

/** Weights, penalties and thresholds. Mirrors the AwardSettings row. */
export type AwardParametros = {
  pesoVolume: number;
  pesoHoras: number;
  pesoConsistencia: number;
  pesoQualidade: number;
  pesoPontualidade: number;
  penalRejeitada: number;
  penalInconsistencia: number;
  penalOutro: number;
  penalAtraso: number;
  tetoNormalizacaoPct: number;
  limiteOutroPct: number;
  minDiasAtividade: number;
  maxRejeitadas: number;
  minPorCargo: number;
  porDepartamento: boolean;
  excluirVencedorAnterior: boolean;
};

export const PARAMETROS_PADRAO: AwardParametros = {
  pesoVolume: 30,
  pesoHoras: 25,
  pesoConsistencia: 20,
  pesoQualidade: 15,
  pesoPontualidade: 10,
  penalRejeitada: 5,
  penalInconsistencia: 3,
  penalOutro: 10,
  penalAtraso: 5,
  tetoNormalizacaoPct: 150,
  limiteOutroPct: 30,
  minDiasAtividade: 15,
  maxRejeitadas: 2,
  minPorCargo: 3,
  porDepartamento: false,
  excluirVencedorAnterior: false,
};

/** One logged activity, flattened for the engine. */
export type AtividadeInput = {
  id: string;
  categoriaId: string;
  /** The category is a catch-all "Outro" bucket. */
  isOutro: boolean;
  dia: Dia;
  /** Minutes past midnight, used only for the overlap check. */
  inicioMin: number;
  fimMin: number;
  minutos: number;
  estado: EstadoAtividade;
  possivelInconsistencia: boolean;
  jaQuestionada: boolean;
  /** The day the entry was written down, not the day the work happened. */
  registadaEmDia: Dia;
};

export type ColaboradorInput = {
  userId: string;
  nome: string;
  cargoId: string | null;
  cargoNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  /** From `diasEsperados()` — already pro-rated for hire date, leave and part time. */
  diasEsperados: number;
  folhaEstado: EstadoFolha | null;
  folhaSubmetidaEm: Dia | null;
  folhaPrazo: Dia | null;
  /** True when this person won the immediately preceding period. */
  venceuPeriodoAnterior: boolean;
  atividades: AtividadeInput[];
};

export type ComponenteBreakdown = {
  /** Raw figure before normalisation (activities, hours, or a 0–1 ratio). */
  bruto: number;
  /** The cargo median it was measured against; null for ratio components. */
  mediana: number | null;
  /** Where the median came from, for the "why not me?" conversation. */
  origemMediana?: "cargo" | "historico" | "empresa" | "indisponivel";
  /** 0–1 after normalisation and capping. */
  normalizado: number;
  peso: number;
  /** normalizado × peso — what it actually contributed. */
  pontos: number;
};

export type Componentes = {
  volume: ComponenteBreakdown;
  horas: ComponenteBreakdown;
  consistencia: ComponenteBreakdown;
  qualidade: ComponenteBreakdown;
  pontualidade: ComponenteBreakdown;
};

export type Penalizacao = {
  tipo: "rejeitada" | "inconsistencia" | "outro" | "atraso";
  rotulo: string;
  quantidade: number;
  pontos: number;
};

export type SinalizacaoAntiGaming = {
  tipo: "duplicada" | "curta" | "excesso_diario";
  atividadeId: string;
  dia: Dia;
  detalhe: string;
};

export type ScoreColaborador = {
  userId: string;
  nome: string;
  cargoId: string | null;
  cargoNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  posicao: number | null;
  pontuacaoTotal: number;
  componentes: Componentes;
  penalizacoes: Penalizacao[];
  /** Headline figures the ranking table shows next to the score. */
  atividadesValidadas: number;
  horasValidadas: number;
  diasComAtividade: number;
  /** Entries the anti-gaming pass touched, for the admin to review. */
  sinalizacoes: SinalizacaoAntiGaming[];
};

export type Ranking = {
  periodo: Periodo;
  parametros: AwardParametros;
  elegiveis: ScoreColaborador[];
  naoElegiveis: ScoreColaborador[];
  /** The top-scoring eligible employee, or null when nobody qualified. */
  proposto: ScoreColaborador | null;
};

/**
 * One ranking row, flattened for the client components.
 *
 * Kept here rather than inferred from the Prisma query so the table, the podium
 * and the export all agree on a shape that crosses the server/client boundary
 * as plain JSON.
 */
export type LinhaRankingView = {
  awardScoreId: string;
  userId: string;
  nome: string;
  email: string;
  photoUrl: string | null;
  cargoNome: string | null;
  departamentoNome: string | null;
  posicao: number | null;
  pontuacaoTotal: number;
  componentes: Componentes;
  penalizacoes: Penalizacao[];
  elegivel: boolean;
  motivoInelegibilidade: string | null;
};

/** Total points lost to penalties on a row. */
export function totalPenalizacoes(penalizacoes: Penalizacao[]): number {
  return penalizacoes.reduce((sum, p) => sum + p.pontos, 0);
}

export const ROTULOS_COMPONENTE: Record<keyof Componentes, string> = {
  volume: "Volume",
  horas: "Horas",
  consistencia: "Consistência",
  qualidade: "Qualidade",
  pontualidade: "Pontualidade",
};

export const EXPLICACOES_COMPONENTE: Record<keyof Componentes, string> = {
  volume:
    "Atividades validadas, normalizadas contra a mediana do cargo e limitadas ao teto, para que fragmentar o trabalho não compense.",
  horas: "Horas validadas, normalizadas contra a mediana do cargo pelo mesmo método.",
  consistencia: "Dias com pelo menos um registo ÷ dias de trabalho esperados.",
  qualidade: "Atividades validadas sem alguma vez terem sido questionadas ÷ total submetido.",
  pontualidade: "Registos feitos no próprio dia ou no dia seguinte ÷ total submetido.",
};
