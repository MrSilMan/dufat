"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";
import { assertAdminRole, requireSession, type Session } from "@/lib/auth";
import {
  calcularLinha,
  calcularRegisto,
  formatCentimos,
  mesmoDesconto,
  parseDesconto,
  parseQuantidadeMil,
  parseValorCentimos,
  repartirPagamento,
  MAX_CENTIMOS,
  type Desconto,
  type LinhaParaCalculo,
} from "@/lib/relatorios/dinheiro";
import { diaParaDate, hojeLuanda, isDia, rotuloDiaCurto, dateParaDia } from "@/lib/relatorios/dia";
import {
  calcularTotais,
  descontoDoRegisto,
  rotuloDesconto,
  totalDoRegisto,
  type PagamentoVista,
  type RegistoVista,
  type TipoLinha,
} from "@/lib/relatorios/resumo";
import { SELECT_REGISTO, colunasDoDesconto, vistaRegisto } from "@/lib/relatorios/queries";
import { acessoRelatorios, podeVerRelatorio } from "@/lib/relatorios/acesso";
import {
  abrirRelatorioSchema,
  acessoRelatoriosSchema,
  alterarDiaRelatorioSchema,
  alternarMetodoPagamentoSchema,
  apagarRegistoSchema,
  finalizarRelatorioSchema,
  metodoPagamentoSchema,
  reabrirRelatorioSchema,
  registoRelatorioSchema,
  type FormState,
} from "@/lib/validation";

type Tx = Prisma.TransactionClient;

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function codigoPrisma(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    ? (error as { code?: string }).code
    : undefined;
}

// ---------- Autosave results ----------

/**
 * Why a write was refused, in a shape the editor can act on without parsing a
 * message: a conflict carries the record as the server now has it, so the
 * screen can offer "keep mine" or "use the saved one" instead of just failing.
 *
 * Validation errors are keyed by field; a line's errors are keyed
 * `linhas.<id>.<campo>`, so the editor can put the message under the right
 * input of the right line without knowing the order they were sent in.
 */
export type FalhaRelatorio =
  | { ok: false; codigo: "VALIDACAO"; message: string; errors: Record<string, string[]> }
  /** `atual` is null when the record was deleted elsewhere. */
  | { ok: false; codigo: "CONFLITO"; message: string; atual: RegistoVista | null }
  | { ok: false; codigo: "FECHADO" | "NAO_ENCONTRADO" | "SEM_ACESSO" | "ERRO"; message: string };

export type ResultadoRegisto =
  | { ok: true; registo: RegistoVista; versaoRelatorio: number }
  | FalhaRelatorio;

export type ResultadoApagar = { ok: true; versaoRelatorio: number } | FalhaRelatorio;

export type ResultadoFinalizar = { ok: true } | FalhaRelatorio;

export type EntradaRegisto = z.input<typeof registoRelatorioSchema>;

/**
 * Thrown inside a transaction to roll it back and hand a result to the caller.
 * A plain `return` would commit whatever the transaction had already written.
 */
class Recusa extends Error {
  constructor(readonly resultado: FalhaRelatorio) {
    super(resultado.message);
  }
}

const recusar = (codigo: "FECHADO" | "NAO_ENCONTRADO", message: string) =>
  new Recusa({ ok: false, codigo, message });

const conflito = (atual: RegistoVista | null, message: string) =>
  new Recusa({ ok: false, codigo: "CONFLITO", message, atual });

const FALHA_GENERICA: FalhaRelatorio = {
  ok: false,
  codigo: "ERRO",
  message: "Não foi possível guardar. Tente de novo.",
};

const MSG_FECHADO = "Este relatório já foi finalizado e não pode ser alterado.";

const SEM_ACESSO: FalhaRelatorio = {
  ok: false,
  codigo: "SEM_ACESSO",
  message: "Deixou de ter acesso aos relatórios. Fale com o administrador.",
};

/**
 * Keeping reports needs the admin's grant, checked on every write rather than
 * only when the page loads: access removed while an editor is open must stop
 * the very next save.
 */
async function podeRegistar(session: Session): Promise<boolean> {
  return (await acessoRelatorios(session)).registar;
}

/**
 * What a history row records about a record: enough to read back what changed
 * without joining to rows that may since have been deleted. Amounts are plain
 * numbers of cêntimos.
 */
function instantaneo(registo: RegistoVista): Prisma.InputJsonObject {
  return {
    tipo: registo.tipo,
    clienteNome: registo.clienteNome,
    clienteNif: registo.clienteNif,
    facturaCodigo: registo.facturaCodigo,
    // With the names they were saved under, so a split reads back without the
    // methods table. Rows written before splits existed carry a single
    // `metodoPagamentoNome` instead; the history reads both.
    pagamentos: registo.pagamentos.map((pagamento) => ({
      metodoPagamentoId: pagamento.metodoPagamentoId,
      metodoPagamentoNome: pagamento.metodoPagamentoNome,
      valorCentimos: pagamento.valorCentimos,
    })),
    nota: registo.nota,
    // As a person reads them — "10%", "1 500,00 Kz" — since that is all the
    // history ever does with them.
    desconto: registo.desconto ? rotuloDesconto(registo.desconto) : null,
    descontoCentimos: descontoDoRegisto(registo),
    total: totalDoRegisto(registo),
    linhas: registo.linhas.map((linha) => ({
      descricao: linha.descricao,
      quantidadeMil: linha.quantidadeMil,
      precoUnitarioCentimos: linha.precoUnitarioCentimos,
      taxaIvaCentesimos: linha.taxaIvaCentesimos,
      precoIncluiIva: linha.precoIncluiIva,
      desconto: linha.desconto ? rotuloDesconto(linha.desconto) : null,
      descontoCentimos: linha.descontoCentimos,
      descontoRegistoCentimos: linha.descontoRegistoCentimos,
      valorCentimos: linha.valorCentimos,
      artigoCodigo: linha.artigoCodigo,
    })),
  };
}

/**
 * Loads a report for writing by its author. Admins read every report but do
 * not write lines into someone else's: the figures are the colaborador's.
 */
async function relatorioDoAutor(tx: Tx, relatorioId: string, session: Session) {
  const relatorio = await tx.relatorioDiario.findUnique({
    where: { id: relatorioId },
    select: { userId: true, estado: true, versao: true },
  });
  if (!relatorio || relatorio.userId !== session.sub) {
    throw recusar("NAO_ENCONTRADO", "Relatório não encontrado.");
  }
  if (relatorio.estado !== "RASCUNHO") throw recusar("FECHADO", MSG_FECHADO);
  return relatorio;
}

/**
 * Bumps the report's version, and is the gate every line write passes through.
 *
 * The conditional update takes the report's row lock, so it serialises against
 * `finalizarRelatorio` (which updates the same row): a line write racing a
 * finalization either commits first — and the finalization then fails its
 * version check — or finds the report already FINALIZADO and rolls back.
 */
async function avancarVersao(tx: Tx, relatorioId: string): Promise<number> {
  const { count } = await tx.relatorioDiario.updateMany({
    where: { id: relatorioId, estado: "RASCUNHO" },
    data: { versao: { increment: 1 } },
  });
  if (count === 0) throw recusar("FECHADO", MSG_FECHADO);
  const { versao } = await tx.relatorioDiario.findUniqueOrThrow({
    where: { id: relatorioId },
    select: { versao: true },
  });
  return versao;
}

/**
 * The name each way of paying is recorded under. A method the record already
 * had keeps the name it was saved with, even if it has since been retired or
 * renamed; only a newly chosen method must still be offered.
 */
async function nomesDosMetodos(
  tx: Tx,
  pagamentos: RegistoPreparado["pagamentos"],
  anteriores: readonly PagamentoVista[],
): Promise<string[]> {
  const nomes: string[] = [];
  for (const [indice, pagamento] of pagamentos.entries()) {
    const anterior = anteriores.find(
      (outro) => outro.metodoPagamentoId === pagamento.metodoPagamentoId,
    );
    if (anterior) {
      nomes.push(anterior.metodoPagamentoNome);
      continue;
    }
    const metodo = await tx.metodoPagamento.findUnique({
      where: { id: pagamento.metodoPagamentoId },
      select: { nome: true, ativo: true },
    });
    if (!metodo?.ativo) {
      const message = "Este método de pagamento já não está disponível. Escolha outro.";
      throw new Recusa({
        ok: false,
        codigo: "VALIDACAO",
        message,
        errors: { [`pagamentos.${indice}.metodoPagamentoId`]: [message] },
      });
    }
    nomes.push(metodo.nome);
  }
  return nomes;
}

/** A record and what was sent are the same when nothing a person typed differs. */
function mesmoConteudo(registo: RegistoVista, enviado: RegistoPreparado): boolean {
  return (
    registo.tipo === enviado.tipo &&
    registo.clienteNome === enviado.clienteNome &&
    registo.clienteNif === enviado.clienteNif &&
    registo.clienteInvgestId === enviado.clienteInvgestId &&
    registo.facturaInvgestId === enviado.facturaInvgestId &&
    registo.facturaCodigo === enviado.facturaCodigo &&
    registo.nota === enviado.nota &&
    mesmoDesconto(registo.desconto, enviado.desconto) &&
    registo.pagamentos.length === enviado.pagamentos.length &&
    registo.pagamentos.every((pagamento, indice) => {
      const outro = enviado.pagamentos[indice]!;
      return (
        pagamento.metodoPagamentoId === outro.metodoPagamentoId &&
        pagamento.valorCentimos === outro.valorCentimos
      );
    }) &&
    registo.linhas.length === enviado.linhas.length &&
    registo.linhas.every((linha, indice) => {
      const outra = enviado.linhas[indice]!;
      return (
        linha.id === outra.id &&
        linha.descricao === outra.descricao &&
        linha.quantidadeMil === outra.quantidadeMil &&
        linha.precoUnitarioCentimos === outra.precoUnitarioCentimos &&
        linha.taxaIvaCentesimos === outra.taxaIvaCentesimos &&
        linha.precoIncluiIva === outra.precoIncluiIva &&
        mesmoDesconto(linha.desconto, outra.desconto) &&
        linha.artigoInvgestId === outra.artigoInvgestId &&
        linha.artigoCodigo === outra.artigoCodigo
      );
    })
  );
}

// ---------- Colaborador: records ----------

/** A record with its amounts parsed — what actually gets written. */
type RegistoPreparado = {
  relatorioId: string;
  id: string;
  versao: number | null;
  tipo: TipoLinha;
  clienteNome: string | null;
  clienteNif: string | null;
  clienteInvgestId: string | null;
  facturaInvgestId: string | null;
  facturaCodigo: string | null;
  nota: string | null;
  desconto: Desconto | null;
  /** Every amount worked out, the last one's included — they add up to the total. */
  pagamentos: { metodoPagamentoId: string; valorCentimos: number }[];
  linhas: {
    id: string;
    descricao: string;
    quantidadeMil: number;
    precoUnitarioCentimos: number;
    taxaIvaCentesimos: number;
    precoIncluiIva: boolean;
    desconto: Desconto | null;
    /** Both of these, and the total, from `calcularRegisto` — see there. */
    descontoCentimos: number;
    descontoRegistoCentimos: number;
    valorCentimos: number;
    artigoInvgestId: string | null;
    artigoCodigo: string | null;
  }[];
};

const DESCONTO_INVALIDO = "Desconto inválido (ex.: 10% ou 1 500,00).";

/**
 * Parses the quantities, prices and discounts the colaborador typed, with the
 * same functions the editor used to show the totals on screen, and prices the
 * record the way the editor did.
 *
 * Errors are keyed per line (`linhas.<id>.<campo>`) so each message lands under
 * the input it is about, however the lines were reordered since.
 */
function prepararRegisto(
  dados: z.output<typeof registoRelatorioSchema>,
): RegistoPreparado | FalhaRelatorio {
  const errors: Record<string, string[]> = {};
  const lidas: { linha: (typeof dados.linhas)[number]; calculo: LinhaParaCalculo }[] = [];

  const ids = new Set<string>();
  for (const linha of dados.linhas) {
    if (ids.has(linha.id)) {
      return { ok: false, codigo: "ERRO", message: "Pedido inválido." };
    }
    ids.add(linha.id);

    const quantidadeMil = parseQuantidadeMil(linha.quantidade);
    const precoUnitarioCentimos = parseValorCentimos(linha.precoUnitario);
    const desconto = parseDesconto(linha.desconto);

    if (quantidadeMil === null) {
      errors[`linhas.${linha.id}.quantidade`] = ["Quantidade inválida (ex.: 2 ou 2,5)."];
    }
    if (precoUnitarioCentimos === null || precoUnitarioCentimos <= 0) {
      errors[`linhas.${linha.id}.precoUnitario`] = ["Preço inválido (ex.: 1 500,00)."];
    }
    if (desconto === "invalido") {
      errors[`linhas.${linha.id}.desconto`] = [DESCONTO_INVALIDO];
    }
    if (quantidadeMil === null || precoUnitarioCentimos === null || desconto === "invalido") {
      continue;
    }

    const calculo: LinhaParaCalculo = {
      quantidadeMil,
      precoUnitarioCentimos,
      taxaIvaCentesimos: linha.taxaIva,
      precoIncluiIva: linha.precoIncluiIva,
      desconto,
    };
    // Checked before the discount: an article has to be worth something for
    // a discount to come off it. After one, down to nothing is allowed — an
    // article given away is a discount of 100%.
    const { bruto, semDesconto } = calcularLinha(calculo);
    if (semDesconto <= 0 || semDesconto > MAX_CENTIMOS) {
      errors[`linhas.${linha.id}.precoUnitario`] = ["Total da linha fora dos limites."];
      continue;
    }
    if (desconto?.tipo === "VALOR" && desconto.centimos > bruto) {
      errors[`linhas.${linha.id}.desconto`] = ["O desconto é maior do que o valor do artigo."];
      continue;
    }
    lidas.push({ linha, calculo });
  }

  const desconto = parseDesconto(dados.desconto);
  if (desconto === "invalido") errors.desconto = [DESCONTO_INVALIDO];

  // Every way of paying but the last was given an amount; the last is the rest
  // of the total, worked out below once the total is known.
  const parciais: number[] = [];
  const escolhidos = new Set<string>();
  for (const [indice, pagamento] of dados.pagamentos.entries()) {
    if (escolhidos.has(pagamento.metodoPagamentoId)) {
      errors[`pagamentos.${indice}.metodoPagamentoId`] = ["Este método já foi escolhido."];
    }
    escolhidos.add(pagamento.metodoPagamentoId);
    if (indice === dados.pagamentos.length - 1) break;

    const valor = parseValorCentimos(pagamento.valor ?? "");
    if (valor === null || valor <= 0) {
      errors[`pagamentos.${indice}.valor`] = ["Valor inválido (ex.: 30 000,00)."];
    } else {
      parciais.push(valor);
    }
  }

  if (Object.keys(errors).length > 0 || desconto === "invalido") {
    return { ok: false, codigo: "VALIDACAO", message: "Verifique os campos assinalados.", errors };
  }

  const calculado = calcularRegisto(
    lidas.map(({ calculo }) => calculo),
    desconto,
  );
  if (calculado.subtotal > MAX_CENTIMOS) {
    const message = "O total do registo excede o limite.";
    return { ok: false, codigo: "VALIDACAO", message, errors: { linhas: [message] } };
  }
  if (desconto?.tipo === "VALOR" && desconto.centimos > calculado.subtotal) {
    const message = "O desconto é maior do que o total do registo.";
    return { ok: false, codigo: "VALIDACAO", message, errors: { desconto: [message] } };
  }

  const { valores, resto } = repartirPagamento(calculado.total, parciais);
  if (parciais.length > 0 && resto <= 0) {
    const message =
      resto < 0
        ? `Os valores indicados passam o total do registo em ${formatCentimos(-resto)}.`
        : "Os valores indicados já somam o total do registo: não sobra nada para o último método.";
    return { ok: false, codigo: "VALIDACAO", message, errors: { pagamentos: [message] } };
  }

  return {
    relatorioId: dados.relatorioId,
    id: dados.id,
    versao: dados.versao,
    tipo: dados.tipo,
    clienteNome: dados.clienteNome,
    clienteNif: dados.clienteNif,
    clienteInvgestId: dados.clienteInvgestId,
    facturaInvgestId: dados.facturaInvgestId,
    facturaCodigo: dados.facturaCodigo,
    nota: dados.nota,
    desconto,
    pagamentos: dados.pagamentos.map((pagamento, indice) => ({
      metodoPagamentoId: pagamento.metodoPagamentoId,
      valorCentimos: valores[indice]!,
    })),
    linhas: lidas.map(({ linha, calculo }, indice) => {
      const precos = calculado.linhas[indice]!;
      return {
        id: linha.id,
        descricao: linha.descricao,
        quantidadeMil: calculo.quantidadeMil,
        precoUnitarioCentimos: calculo.precoUnitarioCentimos,
        taxaIvaCentesimos: calculo.taxaIvaCentesimos,
        precoIncluiIva: calculo.precoIncluiIva,
        desconto: calculo.desconto,
        descontoCentimos: precos.descontoLinha,
        descontoRegistoCentimos: precos.descontoRegisto,
        valorCentimos: precos.total,
        artigoInvgestId: linha.artigoInvgestId,
        artigoCodigo: linha.artigoCodigo,
      };
    }),
  };
}

/**
 * Creates or edits one record — called by the editor as the colaborador works.
 *
 * Returns a result instead of redirecting, unlike `guardarAtividade`: autosave
 * runs in the background while the person keeps typing, and needs the new
 * versions back to base its next save on.
 *
 * Three safeguards make the autosave safe to retry and safe across tabs:
 *
 *   - the record and line ids are generated by the browser, so a save whose
 *     response was lost and is sent again finds the rows it already wrote;
 *   - edits name the `versao` they were based on, so a tab holding an older
 *     copy is told about the newer one rather than silently overwriting it;
 *   - the record and all of its lines are written in one transaction, so a
 *     sale of three articles is never stored as two.
 */
export async function guardarRegisto(input: EntradaRegisto): Promise<ResultadoRegisto> {
  const session = await requireSession("/equipa/entrar");
  if (!(await podeRegistar(session))) return SEM_ACESSO;

  const result = registoRelatorioSchema.safeParse(input);
  if (!result.success) {
    return { ...validationError(result.error), ok: false, codigo: "VALIDACAO" } as FalhaRelatorio;
  }

  const preparado = prepararRegisto(result.data);
  if ("ok" in preparado) return preparado;

  // Twice at most: a retried create can collide on the primary key with the
  // original request still in flight, and on the second pass it finds that row.
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      return await prisma.$transaction((tx) => escreverRegisto(tx, session, preparado));
    } catch (error) {
      if (error instanceof Recusa) return error.resultado;
      if (codigoPrisma(error) === "P2002" && tentativa === 0) continue;
      logger.error("relatorio_registo_falhou", {
        relatorioId: preparado.relatorioId,
        registoId: preparado.id,
        by: session.email,
        message: error instanceof Error ? error.message : String(error),
      });
      return FALHA_GENERICA;
    }
  }
  return FALHA_GENERICA;
}

/** The record as it now stands, read back inside the transaction that wrote it. */
async function lerRegisto(tx: Tx, id: string): Promise<RegistoVista | null> {
  const registo = await tx.registoRelatorio.findUnique({ where: { id }, select: SELECT_REGISTO });
  return registo ? vistaRegisto(registo) : null;
}

/** Line rows for a record — `relatorioId` and `tipo` are copied down from it. */
function linhasParaEscrever(dados: RegistoPreparado): Prisma.LinhaRelatorioUncheckedCreateInput[] {
  return dados.linhas.map((linha, ordem) => ({
    id: linha.id,
    registoId: dados.id,
    relatorioId: dados.relatorioId,
    tipo: dados.tipo,
    descricao: linha.descricao,
    quantidadeMil: linha.quantidadeMil,
    precoUnitarioCentimos: BigInt(linha.precoUnitarioCentimos),
    taxaIvaCentesimos: linha.taxaIvaCentesimos,
    precoIncluiIva: linha.precoIncluiIva,
    ...colunasDoDesconto(linha.desconto),
    descontoCentimos: BigInt(linha.descontoCentimos),
    descontoRegistoCentimos: BigInt(linha.descontoRegistoCentimos),
    valorCentimos: BigInt(linha.valorCentimos),
    artigoInvgestId: linha.artigoInvgestId,
    artigoCodigo: linha.artigoCodigo,
    ordem,
  }));
}

/** Payment rows for a record, in the order they were given. */
function pagamentosParaEscrever(
  dados: RegistoPreparado,
  nomes: readonly string[],
): Prisma.PagamentoRegistoCreateManyInput[] {
  return dados.pagamentos.map((pagamento, ordem) => ({
    registoId: dados.id,
    metodoPagamentoId: pagamento.metodoPagamentoId,
    metodoPagamentoNome: nomes[ordem]!,
    valorCentimos: BigInt(pagamento.valorCentimos),
    ordem,
  }));
}

async function escreverRegisto(
  tx: Tx,
  session: Session,
  dados: RegistoPreparado,
): Promise<ResultadoRegisto> {
  const relatorio = await relatorioDoAutor(tx, dados.relatorioId, session);

  const existente = await tx.registoRelatorio.findUnique({
    where: { id: dados.id },
    select: { ...SELECT_REGISTO, relatorioId: true },
  });
  if (existente && existente.relatorioId !== dados.relatorioId) {
    throw recusar("NAO_ENCONTRADO", "Registo não encontrado.");
  }

  // A line id already in use elsewhere would be moved into this record by the
  // write below, silently taking it off another record.
  const alheias = await tx.linhaRelatorio.findMany({
    where: { id: { in: dados.linhas.map((linha) => linha.id) }, registoId: { not: dados.id } },
    select: { id: true },
  });
  if (alheias.length > 0) {
    throw recusar("NAO_ENCONTRADO", "Linha já registada noutro registo.");
  }

  if (!existente) {
    // The client believed this record was saved; it has since been deleted
    // elsewhere. Recreating it silently would undo that deletion.
    if (dados.versao !== null) {
      throw conflito(null, "Este registo foi apagado noutra janela.");
    }

    const nomes = await nomesDosMetodos(tx, dados.pagamentos, []);
    await tx.registoRelatorio.create({
      data: {
        id: dados.id,
        relatorioId: dados.relatorioId,
        tipo: dados.tipo,
        clienteNome: dados.clienteNome,
        clienteNif: dados.clienteNif,
        clienteInvgestId: dados.clienteInvgestId,
        facturaInvgestId: dados.facturaInvgestId,
        facturaCodigo: dados.facturaCodigo,
        nota: dados.nota,
        ...colunasDoDesconto(dados.desconto),
      },
    });
    await tx.linhaRelatorio.createMany({ data: linhasParaEscrever(dados) });
    await tx.pagamentoRegisto.createMany({ data: pagamentosParaEscrever(dados, nomes) });

    const registo = (await lerRegisto(tx, dados.id))!;
    await tx.relatorioHistorico.create({
      data: {
        relatorioId: dados.relatorioId,
        registoId: registo.id,
        acao: "REGISTO_ADICIONADO",
        depois: instantaneo(registo),
        userId: session.sub,
        userName: session.name,
      },
    });

    return { ok: true, registo, versaoRelatorio: await avancarVersao(tx, dados.relatorioId) };
  }

  const anterior = vistaRegisto(existente);

  if (dados.versao === null) {
    // A create sent again after its response was lost. Same content: that is
    // the record this request already wrote.
    if (mesmoConteudo(anterior, dados)) {
      return { ok: true, registo: anterior, versaoRelatorio: relatorio.versao };
    }
    throw conflito(anterior, "Este registo já tinha sido guardado com outros valores.");
  }

  if (anterior.versao !== dados.versao) {
    throw conflito(anterior, "Este registo foi alterado noutra janela.");
  }

  // Autosave fires on blur too; an unchanged record is not an edit, and must
  // not fill the history with rows that say nothing happened.
  if (mesmoConteudo(anterior, dados)) {
    return { ok: true, registo: anterior, versaoRelatorio: relatorio.versao };
  }

  const nomes = await nomesDosMetodos(tx, dados.pagamentos, anterior.pagamentos);

  const { count } = await tx.registoRelatorio.updateMany({
    where: { id: dados.id, versao: dados.versao },
    data: {
      tipo: dados.tipo,
      clienteNome: dados.clienteNome,
      clienteNif: dados.clienteNif,
      clienteInvgestId: dados.clienteInvgestId,
      facturaInvgestId: dados.facturaInvgestId,
      facturaCodigo: dados.facturaCodigo,
      nota: dados.nota,
      ...colunasDoDesconto(dados.desconto),
      versao: { increment: 1 },
    },
  });
  if (count === 0) {
    throw conflito(await lerRegisto(tx, dados.id), "Este registo foi alterado noutra janela.");
  }

  // Lines are replaced wholesale: what was sent is the record's contents now.
  await tx.linhaRelatorio.deleteMany({
    where: { registoId: dados.id, id: { notIn: dados.linhas.map((linha) => linha.id) } },
  });
  for (const linha of linhasParaEscrever(dados)) {
    const { id, ...campos } = linha;
    await tx.linhaRelatorio.upsert({
      where: { id },
      create: { id, ...campos },
      update: { ...campos, versao: { increment: 1 } },
    });
  }
  // So are the payments. They have no ids of their own to keep: the record's
  // version is what guards them.
  await tx.pagamentoRegisto.deleteMany({ where: { registoId: dados.id } });
  await tx.pagamentoRegisto.createMany({ data: pagamentosParaEscrever(dados, nomes) });

  const registo = (await lerRegisto(tx, dados.id))!;
  await tx.relatorioHistorico.create({
    data: {
      relatorioId: dados.relatorioId,
      registoId: registo.id,
      acao: "REGISTO_EDITADO",
      antes: instantaneo(anterior),
      depois: instantaneo(registo),
      userId: session.sub,
      userName: session.name,
    },
  });

  return { ok: true, registo, versaoRelatorio: await avancarVersao(tx, dados.relatorioId) };
}

/**
 * Deletes one record and its lines from a draft. Deleting a record that is
 * already gone succeeds.
 */
export async function apagarRegisto(
  input: z.input<typeof apagarRegistoSchema>,
): Promise<ResultadoApagar> {
  const session = await requireSession("/equipa/entrar");
  if (!(await podeRegistar(session))) return SEM_ACESSO;

  const result = apagarRegistoSchema.safeParse(input);
  if (!result.success) return { ...FALHA_GENERICA, message: "Pedido inválido." };
  const dados = result.data;

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoApagar> => {
      const relatorio = await relatorioDoAutor(tx, dados.relatorioId, session);

      const existente = await tx.registoRelatorio.findUnique({
        where: { id: dados.id },
        select: { ...SELECT_REGISTO, relatorioId: true },
      });
      if (!existente) return { ok: true, versaoRelatorio: relatorio.versao };
      if (existente.relatorioId !== dados.relatorioId) {
        throw recusar("NAO_ENCONTRADO", "Registo não encontrado.");
      }

      const anterior = vistaRegisto(existente);
      if (anterior.versao !== dados.versao) {
        throw conflito(anterior, "Este registo foi alterado noutra janela antes de o apagar.");
      }

      // Lines go with it: the foreign key cascades.
      const { count } = await tx.registoRelatorio.deleteMany({
        where: { id: dados.id, versao: dados.versao },
      });
      if (count === 0) {
        const atual = await lerRegisto(tx, dados.id);
        if (!atual) return { ok: true, versaoRelatorio: relatorio.versao };
        throw conflito(atual, "Este registo foi alterado noutra janela antes de o apagar.");
      }

      await tx.relatorioHistorico.create({
        data: {
          relatorioId: dados.relatorioId,
          registoId: dados.id,
          acao: "REGISTO_APAGADO",
          antes: instantaneo(anterior),
          userId: session.sub,
          userName: session.name,
        },
      });

      return { ok: true, versaoRelatorio: await avancarVersao(tx, dados.relatorioId) };
    });
  } catch (error) {
    if (error instanceof Recusa) return error.resultado;
    logger.error("relatorio_apagar_registo_falhou", {
      relatorioId: dados.relatorioId,
      registoId: dados.id,
      by: session.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return FALHA_GENERICA;
  }
}
// ---------- Colaborador: report lifecycle ----------

/**
 * Opens the report for a day, creating the draft on first use.
 *
 * Past days are allowed — a shift that ended after closing is filed the next
 * morning — but not future ones, measured against today in Luanda rather than
 * the server's clock.
 */
export async function abrirRelatorio(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession("/equipa/entrar");
  if (!(await podeRegistar(session))) return { ok: false, message: SEM_ACESSO.message };

  const result = abrirRelatorioSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { dia } = result.data;

  if (!isDia(dia)) {
    return { ok: false, message: "Data inválida.", errors: { dia: ["Data inválida."] } };
  }
  if (dia > hojeLuanda()) {
    const message = "Não pode criar relatórios para datas futuras.";
    return { ok: false, message, errors: { dia: [message] } };
  }

  const chave = { userId_dia: { userId: session.sub, dia: diaParaDate(dia) } };
  let id: string;
  try {
    ({ id } = await prisma.relatorioDiario.upsert({
      where: chave,
      create: { userId: session.sub, dia: diaParaDate(dia) },
      update: {},
      select: { id: true },
    }));
  } catch (error) {
    // Two tabs opening the same day at once: the other one created it.
    if (codigoPrisma(error) !== "P2002") throw error;
    ({ id } = await prisma.relatorioDiario.findUniqueOrThrow({ where: chave, select: { id: true } }));
  }

  revalidatePath("/equipa/relatorios");
  redirect(`/equipa/relatorios/${id}`);
}

/**
 * Closes a draft for good (until an admin reopens it).
 *
 * `versao` must match: a tab that has not seen lines added in another tab would
 * otherwise finalize a report whose totals it has never shown its user.
 */
export async function finalizarRelatorio(
  input: z.input<typeof finalizarRelatorioSchema>,
): Promise<ResultadoFinalizar> {
  const session = await requireSession("/equipa/entrar");
  if (!(await podeRegistar(session))) return SEM_ACESSO;

  const result = finalizarRelatorioSchema.safeParse(input);
  if (!result.success) return { ...FALHA_GENERICA, message: "Pedido inválido." };
  const { id, versao } = result.data;

  let resumo: { dia: string; linhas: number; saldo: number };
  try {
    resumo = await prisma.$transaction(async (tx) => {
      const relatorio = await tx.relatorioDiario.findUnique({
        where: { id },
        select: { userId: true, estado: true, dia: true },
      });
      if (!relatorio || relatorio.userId !== session.sub) {
        throw recusar("NAO_ENCONTRADO", "Relatório não encontrado.");
      }
      if (relatorio.estado !== "RASCUNHO") {
        throw recusar("FECHADO", "Este relatório já estava finalizado.");
      }

      const { count } = await tx.relatorioDiario.updateMany({
        where: { id, estado: "RASCUNHO", versao },
        data: {
          estado: "FINALIZADO",
          finalizadoEm: new Date(),
          finalizadoPorId: session.sub,
          versao: { increment: 1 },
        },
      });
      if (count === 0) {
        throw conflito(
          null,
          "Este relatório foi alterado noutra janela. As linhas foram atualizadas — reveja e finalize de novo.",
        );
      }

      // Read after the update holds the row lock, so these are exactly the
      // records that were finalized.
      const registos = (
        await tx.registoRelatorio.findMany({ where: { relatorioId: id }, select: SELECT_REGISTO })
      ).map(vistaRegisto);
      const totais = calcularTotais(registos);
      const linhas = registos.reduce((soma, registo) => soma + registo.linhas.length, 0);

      await tx.relatorioHistorico.create({
        data: {
          relatorioId: id,
          acao: "FINALIZADO",
          depois: {
            linhas,
            vendas: totais.vendas,
            despesas: totais.despesas,
            saldo: totais.saldo,
          },
          userId: session.sub,
          userName: session.name,
        },
      });

      return { dia: dateParaDia(relatorio.dia), linhas, saldo: totais.saldo };
    });
  } catch (error) {
    if (error instanceof Recusa) return error.resultado;
    logger.error("relatorio_finalizar_falhou", {
      relatorioId: id,
      by: session.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ...FALHA_GENERICA, message: "Não foi possível finalizar. Tente de novo." };
  }

  await recordAudit(session, {
    action: "relatorio.finalizado",
    entity: "RelatorioDiario",
    entityId: id,
    summary: `Finalizou o relatório de ${rotuloDiaCurto(resumo.dia)} (${resumo.linhas} linha(s), saldo ${formatCentimos(resumo.saldo)})`,
  });

  revalidarRelatorio(id);
  return { ok: true };
}

/**
 * The report's current version, for a tab coming back into focus to tell
 * whether another tab has changed it meanwhile.
 */
export async function consultarVersaoRelatorio(
  id: string,
): Promise<{ versao: number; estado: "RASCUNHO" | "FINALIZADO" } | null> {
  const session = await requireSession("/equipa/entrar");
  const [relatorio, acesso] = await Promise.all([
    prisma.relatorioDiario.findUnique({
      where: { id },
      select: { userId: true, versao: true, estado: true },
    }),
    acessoRelatorios(session),
  ]);
  if (!relatorio || !podeVerRelatorio(session, acesso, relatorio.userId)) return null;
  return { versao: relatorio.versao, estado: relatorio.estado };
}

// ---------- Administrador ----------

/**
 * Sends a finalized report back to draft so its author can correct it.
 *
 * Admin only, and a reason is required: the reopen is recorded in the report's
 * own history next to the edits that follow it, and in the audit trail.
 */
export async function reabrirRelatorio(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await assertAdminRole();

  const result = reabrirRelatorioSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, motivo } = result.data;

  const relatorio = await prisma.relatorioDiario.findUnique({
    where: { id },
    select: { estado: true, dia: true, user: { select: { name: true } } },
  });
  if (!relatorio) return { ok: false, message: "Relatório não encontrado." };

  const reaberto = await prisma.$transaction(async (tx) => {
    const { count } = await tx.relatorioDiario.updateMany({
      where: { id, estado: "FINALIZADO" },
      data: {
        estado: "RASCUNHO",
        finalizadoEm: null,
        finalizadoPorId: null,
        versao: { increment: 1 },
      },
    });
    if (count === 0) return false;
    await tx.relatorioHistorico.create({
      data: {
        relatorioId: id,
        acao: "REABERTO",
        nota: motivo,
        userId: admin.sub,
        userName: admin.name,
      },
    });
    return true;
  });
  if (!reaberto) return { ok: false, message: "O relatório já está em rascunho." };

  await recordAudit(admin, {
    action: "relatorio.reaberto",
    entity: "RelatorioDiario",
    entityId: id,
    summary: `Reabriu o relatório de ${relatorio.user.name} de ${rotuloDiaCurto(dateParaDia(relatorio.dia))}`,
    meta: { motivo },
  });

  revalidarRelatorio(id);
  // Redirect rather than return: the reopen form only exists on a finalized
  // report, so a returned message would unmount along with it.
  redirect(`/admin/relatorios/${id}?reaberto=1`);
}

/**
 * Moves a report to another day — the colaborador filed it under the wrong
 * one. Admin only, with a reason, like reopening: the move is recorded in the
 * report's own history and in the audit trail.
 *
 * A draft or a finalized report alike; its state stays as it was. The version
 * is bumped, so a tab still showing the old day cannot finalize it unseen.
 * A person has one report per day, so the move is refused onto a day they
 * already have one for — two reports' records are not merged behind anyone's
 * back.
 */
export async function alterarDiaRelatorio(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await assertAdminRole();

  const result = alterarDiaRelatorioSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, dia, motivo } = result.data;

  if (!isDia(dia)) {
    return { ok: false, message: "Data inválida.", errors: { dia: ["Data inválida."] } };
  }
  if (dia > hojeLuanda()) {
    const message = "Não pode passar um relatório para uma data futura.";
    return { ok: false, message, errors: { dia: [message] } };
  }

  const relatorio = await prisma.relatorioDiario.findUnique({
    where: { id },
    select: { dia: true, userId: true, user: { select: { name: true } } },
  });
  if (!relatorio) return { ok: false, message: "Relatório não encontrado." };

  const anterior = dateParaDia(relatorio.dia);
  if (anterior === dia) {
    const message = "O relatório já é desse dia.";
    return { ok: false, message, errors: { dia: [message] } };
  }

  const ocupado = () => {
    const message = `${relatorio.user.name} já tem um relatório de ${rotuloDiaCurto(dia)}. Só pode haver um por dia.`;
    return { ok: false, message, errors: { dia: [message] } };
  };

  let movido: boolean;
  try {
    movido = await prisma.$transaction(async (tx) => {
      // Conditional on the day it was read with: two admins moving the same
      // report at once cannot both succeed and leave one move unrecorded.
      const { count } = await tx.relatorioDiario.updateMany({
        where: { id, dia: relatorio.dia },
        data: { dia: diaParaDate(dia), versao: { increment: 1 } },
      });
      if (count === 0) return false;
      await tx.relatorioHistorico.create({
        data: {
          relatorioId: id,
          acao: "DATA_ALTERADA",
          antes: { dia: anterior },
          depois: { dia },
          nota: motivo,
          userId: admin.sub,
          userName: admin.name,
        },
      });
      return true;
    });
  } catch (error) {
    // The unique (person, day) index: that day is taken.
    if (codigoPrisma(error) === "P2002") return ocupado();
    throw error;
  }
  if (!movido) {
    return { ok: false, message: "O relatório foi alterado entretanto. Recarregue a página." };
  }

  await recordAudit(admin, {
    action: "relatorio.data_alterada",
    entity: "RelatorioDiario",
    entityId: id,
    summary: `Mudou a data do relatório de ${relatorio.user.name}: ${rotuloDiaCurto(anterior)} → ${rotuloDiaCurto(dia)}`,
    meta: { motivo, antes: anterior, depois: dia },
  });

  revalidarRelatorio(id);
  revalidatePath("/equipa/relatorios/equipa");
  return { ok: true, message: `Relatório passado para ${rotuloDiaCurto(dia)}.` };
}

function revalidarRelatorio(id: string): void {
  revalidatePath("/equipa/relatorios");
  revalidatePath(`/equipa/relatorios/${id}`);
  revalidatePath("/admin/relatorios");
  revalidatePath(`/admin/relatorios/${id}`);
}

// ---------- Administrador: payment methods ----------

function revalidarMetodos(): void {
  revalidatePath("/admin/relatorios/metodos");
  revalidatePath("/equipa/relatorios", "layout");
}

async function nomeEmUso(nome: string, excetoId?: string): Promise<boolean> {
  const existente = await prisma.metodoPagamento.findFirst({
    where: {
      nome: { equals: nome, mode: "insensitive" },
      ...(excetoId ? { id: { not: excetoId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(existente);
}

/**
 * Creates or renames a payment method.
 *
 * A rename does not rewrite past records: each payment keeps the name the
 * method had when it was saved, so a finalized report still reads as it did.
 */
export async function guardarMetodoPagamento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await assertAdminRole();

  const result = metodoPagamentoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, nome } = result.data;

  if (await nomeEmUso(nome, id || undefined)) {
    const message = `Já existe um método de pagamento chamado "${nome}".`;
    return { ok: false, message, errors: { nome: [message] } };
  }

  if (id) {
    const anterior = await prisma.metodoPagamento.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!anterior) return { ok: false, message: "Método de pagamento não encontrado." };

    await prisma.metodoPagamento.update({ where: { id }, data: { nome } });
    await recordAudit(admin, {
      action: "metodo_pagamento.atualizado",
      entity: "MetodoPagamento",
      entityId: id,
      summary: `Atualizou o método de pagamento "${anterior.nome}" → "${nome}"`,
    });
    revalidarMetodos();
    return { ok: true, message: `Método "${nome}" atualizado.` };
  }

  const ordem = await prisma.metodoPagamento.aggregate({ _max: { sortOrder: true } });
  const criado = await prisma.metodoPagamento.create({
    data: { nome, sortOrder: (ordem._max.sortOrder ?? -1) + 1 },
  });
  await recordAudit(admin, {
    action: "metodo_pagamento.criado",
    entity: "MetodoPagamento",
    entityId: criado.id,
    summary: `Criou o método de pagamento "${nome}"`,
  });
  revalidarMetodos();
  return { ok: true, message: `Método "${nome}" criado.` };
}

/**
 * Retires or restores a payment method. Retiring only removes it from the
 * picker: records paid with it keep pointing at it and keep its name.
 */
export async function alternarMetodoPagamento(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();

  const result = alternarMetodoPagamentoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  const { id, ativo } = result.data;

  const metodo = await prisma.metodoPagamento.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!metodo) return;

  await prisma.metodoPagamento.update({ where: { id }, data: { ativo } });
  await recordAudit(admin, {
    action: ativo ? "metodo_pagamento.reativado" : "metodo_pagamento.desativado",
    entity: "MetodoPagamento",
    entityId: id,
    summary: `${ativo ? "Reativou" : "Desativou"} o método de pagamento "${metodo.nome}"`,
  });
  revalidarMetodos();
}

// ---------- Administrador: who may use the reports ----------

export type ResultadoAcesso = { ok: true } | { ok: false; message: string };

/**
 * Grants or removes one person's access. Both flags are sent together so the
 * row on screen and the row in the database can never drift apart one toggle
 * at a time.
 */
export async function alterarAcessoRelatorios(
  input: z.input<typeof acessoRelatoriosSchema>,
): Promise<ResultadoAcesso> {
  const admin = await assertAdminRole();

  const result = acessoRelatoriosSchema.safeParse(input);
  if (!result.success) return { ok: false, message: "Pedido inválido." };
  const { userId, registar, ver } = result.data;

  const alvo = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, podeRegistarRelatorios: true, podeVerRelatorios: true },
  });
  if (!alvo) return { ok: false, message: "Utilizador não encontrado." };
  if (alvo.role === "ADMIN") {
    return { ok: false, message: "Os administradores têm sempre acesso total." };
  }
  if (alvo.podeRegistarRelatorios === registar && alvo.podeVerRelatorios === ver) {
    return { ok: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { podeRegistarRelatorios: registar, podeVerRelatorios: ver },
  });

  const sim = (valor: boolean) => (valor ? "sim" : "não");
  await recordAudit(admin, {
    action: "relatorio.acesso_alterado",
    entity: "User",
    entityId: userId,
    summary: `Acesso aos relatórios de ${alvo.name}: registar ${sim(registar)}, ver todos ${sim(ver)}`,
    meta: {
      antes: { registar: alvo.podeRegistarRelatorios, ver: alvo.podeVerRelatorios },
      depois: { registar, ver },
    },
  });

  revalidatePath("/admin/relatorios/acessos");
  return { ok: true };
}
