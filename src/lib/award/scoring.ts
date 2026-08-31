/**
 * The "Funcionário do Mês" scoring engine.
 *
 * Deliberately pure: no Prisma, no `server-only`, no dates beyond the plain
 * strings the caller hands over. Everything that decides who wins an award
 * should be readable and testable without a database, and the numbers stored in
 * `AwardScore.componentes` have to be reproducible months later.
 */

import { diasEntre } from "@/lib/award/periodo";
import type {
  AtividadeInput,
  AwardParametros,
  ColaboradorInput,
  ComponenteBreakdown,
  Componentes,
  Penalizacao,
  Ranking,
  ScoreColaborador,
  SinalizacaoAntiGaming,
} from "@/lib/award/types";

/* ------------------------------------------------------------------ */
/* Anti-gaming                                                         */
/* ------------------------------------------------------------------ */

/** Entries shorter than this count half towards volume. */
const MINUTOS_CURTOS = 10;
/** Entries beyond this many in one day count a quarter towards volume. */
const MAX_ENTRADAS_DIA = 15;
const PESO_ENTRADA_CURTA = 0.5;
const PESO_ENTRADA_EXCEDENTE = 0.25;

type AtividadePesada = AtividadeInput & {
  /** How much this entry counts towards volume: 1, 0.5, 0.25 or 0.125. */
  peso: number;
  /** Dropped as a duplicate — excluded from volume *and* hours. */
  duplicada: boolean;
};

/**
 * Applies the three anti-gaming rules before anything is scored.
 *
 * 1. Two entries in the same category, on the same day, with overlapping times
 *    are the same piece of work written twice: the later one is dropped
 *    entirely (from hours as well as volume) and flagged for the admin.
 * 2. Entries under 10 minutes count half — real work rounds to more than that,
 *    and a stream of 3-minute entries is volume manufacturing.
 * 3. Past 15 entries in a single day, each further entry counts a quarter.
 *
 * Rules 2 and 3 multiply: an entry that is both very short and the 20th of the
 * day is being fragmented on both axes and counts 0.125. The duplicate check
 * runs first so a dropped entry never consumes one of the 15 daily slots.
 */
export function aplicarAntiGaming(atividades: AtividadeInput[]): {
  pesadas: AtividadePesada[];
  sinalizacoes: SinalizacaoAntiGaming[];
} {
  const sinalizacoes: SinalizacaoAntiGaming[] = [];

  // Stable order: by day, then start time, then id. Ranking must not depend on
  // the order rows came back from the database.
  const ordenadas = [...atividades].sort(
    (a, b) =>
      a.dia.localeCompare(b.dia) || a.inicioMin - b.inicioMin || a.id.localeCompare(b.id),
  );

  const mantidas: AtividadeInput[] = [];
  const duplicadas = new Set<string>();

  for (const act of ordenadas) {
    const original = mantidas.find(
      (kept) =>
        kept.dia === act.dia &&
        kept.categoriaId === act.categoriaId &&
        act.inicioMin < kept.fimMin &&
        kept.inicioMin < act.fimMin,
    );
    if (original) {
      duplicadas.add(act.id);
      sinalizacoes.push({
        tipo: "duplicada",
        atividadeId: act.id,
        dia: act.dia,
        detalhe: `Sobrepõe-se a outra entrada da mesma categoria no mesmo dia; contada uma só vez.`,
      });
      continue;
    }
    mantidas.push(act);
  }

  const contagemPorDia = new Map<string, number>();
  const pesadas: AtividadePesada[] = [];

  for (const act of ordenadas) {
    if (duplicadas.has(act.id)) {
      pesadas.push({ ...act, peso: 0, duplicada: true });
      continue;
    }

    let peso = 1;

    if (act.minutos < MINUTOS_CURTOS) {
      peso *= PESO_ENTRADA_CURTA;
      sinalizacoes.push({
        tipo: "curta",
        atividadeId: act.id,
        dia: act.dia,
        detalhe: `Entrada de ${act.minutos} min (< ${MINUTOS_CURTOS} min): conta ${PESO_ENTRADA_CURTA} no volume.`,
      });
    }

    const ordem = (contagemPorDia.get(act.dia) ?? 0) + 1;
    contagemPorDia.set(act.dia, ordem);
    if (ordem > MAX_ENTRADAS_DIA) {
      peso *= PESO_ENTRADA_EXCEDENTE;
      sinalizacoes.push({
        tipo: "excesso_diario",
        atividadeId: act.id,
        dia: act.dia,
        detalhe: `Entrada nº ${ordem} do dia (limite ${MAX_ENTRADAS_DIA}): conta ${PESO_ENTRADA_EXCEDENTE} no volume.`,
      });
    }

    pesadas.push({ ...act, peso, duplicada: false });
  }

  return { pesadas, sinalizacoes };
}

/* ------------------------------------------------------------------ */
/* Raw figures                                                         */
/* ------------------------------------------------------------------ */

export type BrutosColaborador = {
  /** Anti-gaming-weighted count of validated activities. */
  volume: number;
  /** Validated hours. Duplicates are excluded; fragmentation weights are not
   *  applied here — an hour worked is an hour worked. */
  horas: number;
  horasOutro: number;
  diasComAtividade: number;
  atividadesValidadas: number;
  totalSubmetidas: number;
  validadasSemQuestao: number;
  registadasATempo: number;
  rejeitadas: number;
  inconsistenciasQuestionadas: number;
};

function calcularBrutos(pesadas: AtividadePesada[]): BrutosColaborador {
  const brutos: BrutosColaborador = {
    volume: 0,
    horas: 0,
    horasOutro: 0,
    diasComAtividade: 0,
    atividadesValidadas: 0,
    totalSubmetidas: 0,
    validadasSemQuestao: 0,
    registadasATempo: 0,
    rejeitadas: 0,
    inconsistenciasQuestionadas: 0,
  };

  const dias = new Set<string>();

  for (const act of pesadas) {
    if (act.duplicada) continue;

    // "Submitted" is everything that left the employee's hands — a draft was
    // never claimed, so it must not dilute the quality ratio.
    const submetida = act.estado !== "RASCUNHO";
    if (submetida) brutos.totalSubmetidas += 1;

    // Consistency counts days the person actually worked and said so. A
    // rejected entry is not evidence of a worked day.
    if (act.estado !== "REJEITADA" && act.estado !== "RASCUNHO") dias.add(act.dia);

    if (act.estado === "REJEITADA") brutos.rejeitadas += 1;
    if (act.possivelInconsistencia && act.jaQuestionada) {
      brutos.inconsistenciasQuestionadas += 1;
    }

    if (submetida) {
      const atraso = diasEntre(act.dia, act.registadaEmDia);
      if (atraso <= 1) brutos.registadasATempo += 1;
    }

    if (act.estado === "VALIDADA") {
      brutos.atividadesValidadas += 1;
      brutos.volume += act.peso;
      const horas = act.minutos / 60;
      brutos.horas += horas;
      if (act.isOutro) brutos.horasOutro += horas;
      if (!act.jaQuestionada) brutos.validadasSemQuestao += 1;
    }
  }

  brutos.diasComAtividade = dias.size;
  return brutos;
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1]! + ordenados[meio]!) / 2
    : ordenados[meio]!;
}

/**
 * Maps a raw figure onto 0–1 against the cargo median.
 *
 * The cap is what stops runaway volume: performing at the cap (150% of the
 * median by default) is full marks, so there is nothing to gain by logging
 * more. The median performer lands at 1/1.5 ≈ 0.67 of the component — the
 * scale rewards being clearly above your peers, not merely present.
 */
export function normalizar(bruto: number, mediana_: number, tetoPct: number): number {
  const teto = Math.max(tetoPct, 100) / 100;
  if (mediana_ <= 0) return bruto > 0 ? 1 : 0;
  return Math.min(bruto / mediana_, teto) / teto;
}

function componente(
  bruto: number,
  medianaValor: number | null,
  normalizado: number,
  peso: number,
  origem?: ComponenteBreakdown["origemMediana"],
): ComponenteBreakdown {
  const limpo = Math.min(Math.max(normalizado, 0), 1);
  return {
    bruto: round2(bruto),
    mediana: medianaValor === null ? null : round2(medianaValor),
    origemMediana: origem,
    normalizado: round4(limpo),
    peso,
    pontos: round2(limpo * peso),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

/**
 * Why this person is not in the ranking, or null if they are.
 *
 * Checked before scoring, and the reason is stored verbatim so the "Não
 * elegíveis" list can explain itself rather than just omitting people.
 */
export function avaliarElegibilidade(
  colaborador: ColaboradorInput,
  pesadas: AtividadePesada[],
  brutos: BrutosColaborador,
  parametros: AwardParametros,
  diasUteisMes: number,
): string | null {
  if (colaborador.folhaEstado !== "FECHADA") {
    return colaborador.folhaEstado === null
      ? "Sem folha para o período."
      : `Folha ainda ${colaborador.folhaEstado === "ABERTA" ? "aberta" : "por fechar"}.`;
  }

  const emAberto = pesadas.filter(
    (a) => a.estado === "EM_JUSTIFICACAO" || a.estado === "JUSTIFICADA",
  ).length;
  if (emAberto > 0) {
    return `${emAberto} atividade(s) ainda em justificação.`;
  }

  // Pro-rated against this person's own expected days: someone hired on the
  // 20th cannot reach a flat 15 no matter how well they work.
  const minimo = exigenciaDeDias(parametros.minDiasAtividade, colaborador.diasEsperados, diasUteisMes);
  if (brutos.diasComAtividade < minimo) {
    return `Apenas ${brutos.diasComAtividade} dias com registo (mínimo ${minimo} para ${colaborador.diasEsperados} dias esperados).`;
  }

  if (brutos.rejeitadas > parametros.maxRejeitadas) {
    return `${brutos.rejeitadas} atividades rejeitadas (máximo ${parametros.maxRejeitadas}).`;
  }

  if (parametros.excluirVencedorAnterior && colaborador.venceuPeriodoAnterior) {
    return "Venceu o período anterior (rotação do prémio ativa).";
  }

  return null;
}

/** The minimum-days rule, scaled to the employee's expected days. */
export function exigenciaDeDias(
  minimoBase: number,
  esperados: number,
  diasUteisMes: number,
): number {
  if (diasUteisMes <= 0) return 0;
  const escalado = Math.ceil((minimoBase / diasUteisMes) * esperados);
  // Never demand more days than the person was expected to work.
  return Math.max(0, Math.min(escalado, esperados));
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

/** Median volume/hours per cargo, carried over from previous confirmed months. */
export type MedianasHistoricas = Map<string, { volume: number; horas: number }>;

export type CalcularRankingInput = {
  periodo: string;
  colaboradores: ColaboradorInput[];
  parametros: AwardParametros;
  diasUteisMes: number;
  /** Fallback medians per cargoId for cargos with too few people this month. */
  historicas?: MedianasHistoricas;
};

/**
 * Scores everyone and ranks the eligible.
 *
 * Ineligible employees are scored too. The spec checks eligibility *before*
 * scoring, and it does — they are never ranked — but the breakdown is still
 * computed and stored, because "you were excluded" is a much worse answer than
 * "you were excluded, and here is where you stood anyway".
 */
export function calcularRanking(input: CalcularRankingInput): Ranking {
  const { colaboradores, parametros, diasUteisMes } = input;

  type Preparado = {
    colaborador: ColaboradorInput;
    pesadas: AtividadePesada[];
    sinalizacoes: SinalizacaoAntiGaming[];
    brutos: BrutosColaborador;
    motivo: string | null;
  };

  const preparados: Preparado[] = colaboradores.map((colaborador) => {
    const { pesadas, sinalizacoes } = aplicarAntiGaming(colaborador.atividades);
    const brutos = calcularBrutos(pesadas);
    const motivo = avaliarElegibilidade(colaborador, pesadas, brutos, parametros, diasUteisMes);
    return { colaborador, pesadas, sinalizacoes, brutos, motivo };
  });

  // Medians come from the eligible cohort only. Including someone who logged
  // two days before going on leave would drag the median down and inflate
  // everybody else's normalised volume.
  const elegiveisPrep = preparados.filter((p) => p.motivo === null);

  const porCargo = new Map<string, Preparado[]>();
  for (const p of elegiveisPrep) {
    const key = p.colaborador.cargoId ?? "__sem_cargo__";
    const bucket = porCargo.get(key);
    if (bucket) bucket.push(p);
    else porCargo.set(key, [p]);
  }

  const medianaEmpresaVolume = mediana(elegiveisPrep.map((p) => p.brutos.volume));
  const medianaEmpresaHoras = mediana(elegiveisPrep.map((p) => p.brutos.horas));

  /**
   * Median chain for a cargo: its own people this month when there are enough
   * of them, else that cargo's history, else the company this month. A cargo of
   * one would otherwise be normalised against itself and score a guaranteed
   * 100% — the cap would make every soloist a winner.
   */
  function medianasPara(cargoId: string | null): {
    volume: number;
    horas: number;
    origem: ComponenteBreakdown["origemMediana"];
  } {
    const key = cargoId ?? "__sem_cargo__";
    const pares = porCargo.get(key) ?? [];
    if (pares.length >= parametros.minPorCargo) {
      return {
        volume: mediana(pares.map((p) => p.brutos.volume)),
        horas: mediana(pares.map((p) => p.brutos.horas)),
        origem: "cargo",
      };
    }
    const historica = cargoId ? input.historicas?.get(cargoId) : undefined;
    if (historica && (historica.volume > 0 || historica.horas > 0)) {
      return { volume: historica.volume, horas: historica.horas, origem: "historico" };
    }
    if (medianaEmpresaVolume > 0 || medianaEmpresaHoras > 0) {
      return { volume: medianaEmpresaVolume, horas: medianaEmpresaHoras, origem: "empresa" };
    }
    return { volume: 0, horas: 0, origem: "indisponivel" };
  }

  const scores: ScoreColaborador[] = preparados.map(
    ({ colaborador, brutos, sinalizacoes, motivo }) => {
      const med = medianasPara(colaborador.cargoId);

      const componentes: Componentes = {
        volume: componente(
          brutos.volume,
          med.volume,
          normalizar(brutos.volume, med.volume, parametros.tetoNormalizacaoPct),
          parametros.pesoVolume,
          med.origem,
        ),
        horas: componente(
          brutos.horas,
          med.horas,
          normalizar(brutos.horas, med.horas, parametros.tetoNormalizacaoPct),
          parametros.pesoHoras,
          med.origem,
        ),
        consistencia: componente(
          brutos.diasComAtividade,
          colaborador.diasEsperados,
          colaborador.diasEsperados > 0
            ? brutos.diasComAtividade / colaborador.diasEsperados
            : 0,
          parametros.pesoConsistencia,
        ),
        qualidade: componente(
          brutos.totalSubmetidas > 0 ? brutos.validadasSemQuestao / brutos.totalSubmetidas : 0,
          null,
          brutos.totalSubmetidas > 0 ? brutos.validadasSemQuestao / brutos.totalSubmetidas : 0,
          parametros.pesoQualidade,
        ),
        pontualidade: componente(
          brutos.totalSubmetidas > 0 ? brutos.registadasATempo / brutos.totalSubmetidas : 0,
          null,
          brutos.totalSubmetidas > 0 ? brutos.registadasATempo / brutos.totalSubmetidas : 0,
          parametros.pesoPontualidade,
        ),
      };

      const penalizacoes = calcularPenalizacoes(colaborador, brutos, parametros);

      const bruto =
        componentes.volume.pontos +
        componentes.horas.pontos +
        componentes.consistencia.pontos +
        componentes.qualidade.pontos +
        componentes.pontualidade.pontos;
      const descontos = penalizacoes.reduce((sum, p) => sum + p.pontos, 0);

      return {
        userId: colaborador.userId,
        nome: colaborador.nome,
        cargoId: colaborador.cargoId,
        cargoNome: colaborador.cargoNome,
        departamentoId: colaborador.departamentoId,
        departamentoNome: colaborador.departamentoNome,
        elegivel: motivo === null,
        motivoInelegibilidade: motivo,
        posicao: null,
        pontuacaoTotal: round2(Math.max(0, Math.min(100, bruto - descontos))),
        componentes,
        penalizacoes,
        atividadesValidadas: brutos.atividadesValidadas,
        horasValidadas: round2(brutos.horas),
        diasComAtividade: brutos.diasComAtividade,
        sinalizacoes,
      };
    },
  );

  const elegiveis = scores
    .filter((s) => s.elegivel)
    .sort(
      (a, b) =>
        b.pontuacaoTotal - a.pontuacaoTotal ||
        b.horasValidadas - a.horasValidadas ||
        b.atividadesValidadas - a.atividadesValidadas ||
        a.nome.localeCompare(b.nome, "pt"),
    );
  elegiveis.forEach((s, i) => {
    s.posicao = i + 1;
  });

  const naoElegiveis = scores
    .filter((s) => !s.elegivel)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  return {
    periodo: input.periodo,
    parametros,
    elegiveis,
    naoElegiveis,
    proposto: elegiveis[0] ?? null,
  };
}

function calcularPenalizacoes(
  colaborador: ColaboradorInput,
  brutos: BrutosColaborador,
  parametros: AwardParametros,
): Penalizacao[] {
  const out: Penalizacao[] = [];

  if (brutos.rejeitadas > 0) {
    out.push({
      tipo: "rejeitada",
      rotulo: "Atividades rejeitadas",
      quantidade: brutos.rejeitadas,
      pontos: brutos.rejeitadas * parametros.penalRejeitada,
    });
  }

  if (brutos.inconsistenciasQuestionadas > 0) {
    out.push({
      tipo: "inconsistencia",
      rotulo: "Inconsistências questionadas",
      quantidade: brutos.inconsistenciasQuestionadas,
      pontos: brutos.inconsistenciasQuestionadas * parametros.penalInconsistencia,
    });
  }

  const pctOutro = brutos.horas > 0 ? (brutos.horasOutro / brutos.horas) * 100 : 0;
  if (pctOutro > parametros.limiteOutroPct) {
    out.push({
      tipo: "outro",
      rotulo: `"Outro" acima de ${parametros.limiteOutroPct}% das horas`,
      quantidade: Math.round(pctOutro),
      pontos: parametros.penalOutro,
    });
  }

  if (
    colaborador.folhaPrazo &&
    colaborador.folhaSubmetidaEm &&
    colaborador.folhaSubmetidaEm > colaborador.folhaPrazo
  ) {
    out.push({
      tipo: "atraso",
      rotulo: "Folha submetida fora do prazo",
      quantidade: diasEntre(colaborador.folhaPrazo, colaborador.folhaSubmetidaEm),
      pontos: parametros.penalAtraso,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Annual award                                                        */
/* ------------------------------------------------------------------ */

export type EntradaAnual = {
  userId: string;
  nome: string;
  cargoNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  /** Confirmed monthly wins in the year. */
  vitorias: number;
  /** Months the employee was ranked, used for the average. */
  mesesPontuados: number;
  somaPontuacoes: number;
};

export type LinhaAnual = EntradaAnual & {
  posicao: number;
  mediaMensal: number;
};

/**
 * Funcionário do Ano: most confirmed monthly wins, average monthly score as the
 * tiebreaker. Wins come first on purpose — the annual award recognises repeated
 * recognition, not one enormous month.
 */
export function classificarAnual(entradas: EntradaAnual[]): LinhaAnual[] {
  return entradas
    .map((e) => ({
      ...e,
      mediaMensal: e.mesesPontuados > 0 ? round2(e.somaPontuacoes / e.mesesPontuados) : 0,
      posicao: 0,
    }))
    .sort(
      (a, b) =>
        b.vitorias - a.vitorias ||
        b.mediaMensal - a.mediaMensal ||
        a.nome.localeCompare(b.nome, "pt"),
    )
    .map((linha, i) => ({ ...linha, posicao: i + 1 }));
}
