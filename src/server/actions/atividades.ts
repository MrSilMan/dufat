"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { assertGestaoRH, requireSession, type Session } from "@/lib/auth";
import { isPeriodo, monthRange, toDia, toPeriodo, type Periodo } from "@/lib/award/periodo";
import { POR_REVER } from "@/lib/award/types";
import { MAX_ENTRADAS_DIA, duracaoCurta, sobrepoe } from "@/lib/award/inconsistencia";
import {
  atividadeSchema,
  folhaAcaoSchema,
  revisaoAtividadeSchema,
  type AtividadeFormState,
  type FormState,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/** A `YYYY-MM-DD` day plus a `HH:MM` time as a UTC instant. */
function instante(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00.000Z`);
}

/**
 * The sheet for someone's month, created on first use.
 *
 * The deadline defaults to the 5th of the following month: late submission is a
 * scored penalty, so the sheet has to carry a deadline from the moment it
 * exists rather than acquiring one retroactively.
 */
async function garantirFolha(userId: string, periodo: Periodo) {
  const existente = await prisma.folhaMensal.findUnique({
    where: { userId_periodo: { userId, periodo } },
  });
  if (existente) return existente;

  const { endExclusive } = monthRange(periodo);
  const prazo = new Date(endExclusive);
  prazo.setUTCDate(5);

  return prisma.folhaMensal.create({
    data: { userId, periodo, prazoSubmissao: prazo },
  });
}

/**
 * Flags an entry the anti-gaming rules would discount.
 *
 * The flag is only a marker: it costs nothing on its own, and only becomes a
 * penalty if a reviewer actually questions the entry. Detecting at write time
 * means the reviewer sees the reason next to the row instead of having to spot
 * the pattern by eye.
 *
 * The rules themselves live in `@/lib/award/inconsistencia` because the screens
 * re-derive them to tell the employee *which* one fired.
 */
async function detetarInconsistencia(input: {
  atividadeId?: string;
  userId: string;
  dia: Date;
  categoriaId: string;
  inicioEm: Date;
  fimEm: Date;
  minutos: number;
}): Promise<boolean> {
  if (duracaoCurta(input.minutos)) return true;

  const irmas = await prisma.atividade.findMany({
    where: {
      userId: input.userId,
      dia: input.dia,
      ...(input.atividadeId ? { id: { not: input.atividadeId } } : {}),
      estado: { not: "REJEITADA" },
    },
    select: { categoriaId: true, inicioEm: true, fimEm: true },
  });

  if (irmas.length + 1 > MAX_ENTRADAS_DIA) return true;

  return irmas.some(
    (irma) => irma.categoriaId === input.categoriaId && sobrepoe(input, irma),
  );
}

/**
 * Creates or edits one activity on the author's own sheet.
 *
 * Only drafts and entries sent back for justification can be edited, and only
 * by their author: once something is validated it is evidence behind a score,
 * and letting it be rewritten afterwards would make every past ranking
 * unreproducible.
 */
export async function guardarAtividade(
  _prev: AtividadeFormState,
  formData: FormData,
): Promise<AtividadeFormState> {
  const session = await requireSession();

  const result = atividadeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, categoriaId, descricao, dia, inicio, fim } = result.data;

  const inicioEm = instante(dia, inicio);
  const fimEm = instante(dia, fim);
  const minutos = Math.round((fimEm.getTime() - inicioEm.getTime()) / 60_000);
  const diaDate = new Date(`${dia}T00:00:00.000Z`);
  const periodo = toPeriodo(diaDate);

  if (id) {
    const existente = await prisma.atividade.findUnique({
      where: { id },
      select: { userId: true, estado: true, folha: { select: { estado: true } } },
    });
    if (!existente || existente.userId !== session.sub) {
      return { ok: false, message: "Atividade não encontrada." };
    }
    if (existente.estado !== "RASCUNHO" && existente.estado !== "EM_JUSTIFICACAO") {
      return {
        ok: false,
        message: "Só pode editar rascunhos ou atividades devolvidas para justificação.",
      };
    }
    if (existente.folha.estado === "FECHADA") {
      return { ok: false, message: "A folha deste mês já está fechada." };
    }

    const suspeita = await detetarInconsistencia({
      atividadeId: id,
      userId: session.sub,
      dia: diaDate,
      categoriaId,
      inicioEm,
      fimEm,
      minutos,
    });

    await prisma.atividade.update({
      where: { id },
      data: {
        categoriaId,
        descricao,
        dia: diaDate,
        inicioEm,
        fimEm,
        minutos,
        possivelInconsistencia: suspeita,
        // Answering a question moves the entry to JUSTIFICADA; the reviewer
        // decides from there. jaQuestionada stays latched on purpose.
        estado: existente.estado === "EM_JUSTIFICACAO" ? "JUSTIFICADA" : "RASCUNHO",
      },
    });

    revalidarEquipa();
    return { ok: true, message: "Atividade atualizada.", atividadeId: id };
  }

  const folha = await garantirFolha(session.sub, periodo);
  if (folha.estado === "FECHADA") {
    return { ok: false, message: "A folha deste mês já está fechada." };
  }

  const suspeita = await detetarInconsistencia({
    userId: session.sub,
    dia: diaDate,
    categoriaId,
    inicioEm,
    fimEm,
    minutos,
  });

  const criada = await prisma.atividade.create({
    select: { id: true },
    data: {
      folhaId: folha.id,
      userId: session.sub,
      categoriaId,
      descricao,
      dia: diaDate,
      inicioEm,
      fimEm,
      minutos,
      estado: "RASCUNHO",
      possivelInconsistencia: suspeita,
      // Punctuality is measured from this, so it is the real clock time the
      // entry was written — never the day it describes.
      registadaEm: new Date(),
    },
  });

  revalidarEquipa();
  return { ok: true, message: "Atividade registada.", atividadeId: criada.id };
}

/** The employee area is two screens over one sheet; both go stale together. */
function revalidarEquipa(): void {
  revalidatePath("/equipa");
  revalidatePath("/equipa/registos");
}

/** Employee deletes one of their own drafts. */
export async function apagarAtividade(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const atividade = await prisma.atividade.findUnique({
    where: { id },
    select: { userId: true, estado: true },
  });
  if (!atividade || atividade.userId !== session.sub || atividade.estado !== "RASCUNHO") return;

  await prisma.atividade.delete({ where: { id } });
  revalidarEquipa();
}

/**
 * A reviewer's verdict on one activity.
 *
 * `jaQuestionada` latches the first time an entry is sent back and is never
 * cleared: the quality component counts work validated *without ever* having
 * been questioned, so clearing it on the eventual approval would erase exactly
 * the signal it measures.
 */
export async function revisarAtividade(formData: FormData): Promise<void> {
  const revisor = await assertGestaoRH();

  const result = revisaoAtividadeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  const { id, acao, nota } = result.data;

  const atividade = await prisma.atividade.findUnique({
    where: { id },
    select: {
      id: true,
      descricao: true,
      estado: true,
      user: { select: { id: true, name: true } },
      folha: { select: { id: true, periodo: true, estado: true } },
    },
  });
  if (!atividade) return;
  if (atividade.folha.estado === "FECHADA" && acao !== "reabrir") return;

  const estado = {
    validar: "VALIDADA",
    questionar: "EM_JUSTIFICACAO",
    rejeitar: "REJEITADA",
    reabrir: "SUBMETIDA",
  }[acao] as "VALIDADA" | "EM_JUSTIFICACAO" | "REJEITADA" | "SUBMETIDA";

  await prisma.atividade.update({
    where: { id },
    data: {
      estado,
      notaRevisao: nota || null,
      revistaEm: new Date(),
      revistaPorId: revisor.sub,
      ...(acao === "questionar" ? { jaQuestionada: true } : {}),
    },
  });

  const acoesAudit = {
    validar: "atividade.validada",
    questionar: "atividade.questionada",
    rejeitar: "atividade.rejeitada",
    reabrir: "atividade.reaberta",
  } as const;

  await recordAudit(revisor, {
    action: acoesAudit[acao],
    entity: "Atividade",
    entityId: atividade.id,
    summary: `${acaoRotulo(acao)} a atividade "${truncar(atividade.descricao)}" de ${atividade.user.name} (${atividade.folha.periodo})`,
    meta: { de: atividade.estado, para: estado, nota: nota ?? null },
  });

  revalidatePath(`/admin/folhas/${atividade.folha.id}`);
  revalidatePath("/admin/folhas");
}

function acaoRotulo(acao: "validar" | "questionar" | "rejeitar" | "reabrir"): string {
  return { validar: "Validou", questionar: "Questionou", rejeitar: "Rejeitou", reabrir: "Reabriu" }[
    acao
  ];
}

function truncar(texto: string, max = 60): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/**
 * Moves a sheet through submitted → closed, or back.
 *
 * Only a FECHADA sheet enters the ranking, so closing is the deliberate act
 * that says "these numbers are final". Reopening a closed sheet is allowed —
 * mistakes happen — but it is audited, and any already-confirmed award for that
 * month is untouched by design.
 */
export async function acaoFolha(formData: FormData): Promise<void> {
  const session = await requireSession();

  const result = folhaAcaoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  const { folhaId, acao } = result.data;

  const folha = await prisma.folhaMensal.findUnique({
    where: { id: folhaId },
    select: {
      id: true,
      periodo: true,
      estado: true,
      userId: true,
      submetidaEm: true,
      user: { select: { name: true } },
      _count: { select: { atividades: true } },
    },
  });
  if (!folha) return;

  // Employees submit their own sheet; only RH closes or reopens one.
  if (acao === "submeter") {
    if (folha.userId !== session.sub && !podeGerirFolhas(session)) return;
    if (folha.estado !== "ABERTA") return;

    await prisma.$transaction([
      prisma.atividade.updateMany({
        where: { folhaId: folha.id, estado: "RASCUNHO" },
        data: { estado: "SUBMETIDA" },
      }),
      prisma.folhaMensal.update({
        where: { id: folha.id },
        // The first submission is the one punctuality is measured from. RH
        // reopening a sheet in the following month and the employee resubmitting
        // must not restamp it — that would read as a late submission and cost
        // penalAtraso for an action the employee did not take.
        data: { estado: "SUBMETIDA", submetidaEm: folha.submetidaEm ?? new Date() },
      }),
    ]);

    await recordAudit(session, {
      action: "folha.submetida",
      entity: "FolhaMensal",
      entityId: folha.id,
      summary: `Submeteu a folha de ${folha.user.name} de ${folha.periodo} (${folha._count.atividades} atividades)`,
    });
    revalidarEquipa();
    revalidatePath("/admin/folhas");
    return;
  }

  const rh = await assertGestaoRH();

  if (acao === "fechar") {
    if (folha.estado === "FECHADA") return;
    await prisma.$transaction([
      // Anything still sitting as a draft on a closed sheet was never claimed;
      // treating it as submitted at closing time would score work the employee
      // did not stand behind.
      prisma.folhaMensal.update({
        where: { id: folha.id },
        data: { estado: "FECHADA", fechadaEm: new Date(), fechadaPorId: rh.sub },
      }),
    ]);
    await recordAudit(rh, {
      action: "folha.fechada",
      entity: "FolhaMensal",
      entityId: folha.id,
      summary: `Fechou a folha de ${folha.user.name} de ${folha.periodo}`,
    });
  } else {
    if (folha.estado === "ABERTA") return;
    await prisma.folhaMensal.update({
      where: { id: folha.id },
      data: { estado: "ABERTA", fechadaEm: null, fechadaPorId: null },
    });
    await recordAudit(rh, {
      action: "folha.reaberta",
      entity: "FolhaMensal",
      entityId: folha.id,
      summary: `Reabriu a folha de ${folha.user.name} de ${folha.periodo}`,
    });
  }

  revalidatePath("/admin/folhas");
  revalidatePath(`/admin/folhas/${folha.id}`);
}

/**
 * Closes every sheet in a month that is unambiguously finished.
 *
 * Closing row by row is fine for a handful of people and a chore for a whole
 * company — and a sheet nobody remembered to close never enters the ranking at
 * all, which looks identical to someone having a bad month. This closes only
 * the sheets where neither side has anything left to do, and deliberately skips
 * two cases rather than guessing:
 *
 *   - still ABERTA — the employee never submitted, and closing would freeze
 *     their drafts unclaimed (drafts do not score, see `fechar` below);
 *   - entries still in review — RH has not judged the work yet, and anything
 *     left in justification makes the employee ineligible outright.
 *
 * Both keep their per-row "Fechar" button, so the deliberate override survives.
 * The counts come back as query params because the caller is a server component
 * with no other way to say what happened.
 */
export async function fecharFolhasDoPeriodo(formData: FormData): Promise<void> {
  const rh = await assertGestaoRH();

  const periodo = String(formData.get("periodo") ?? "");
  if (!isPeriodo(periodo)) return;

  const folhas = await prisma.folhaMensal.findMany({
    where: { periodo, estado: { not: "FECHADA" } },
    select: { id: true, estado: true, atividades: { select: { estado: true } } },
  });

  const prontas: string[] = [];
  let abertas = 0;
  let porRever = 0;

  for (const folha of folhas) {
    if (folha.estado !== "SUBMETIDA") {
      abertas += 1;
    } else if (folha.atividades.some((a) => POR_REVER.has(a.estado))) {
      porRever += 1;
    } else {
      prontas.push(folha.id);
    }
  }

  if (prontas.length > 0) {
    await prisma.folhaMensal.updateMany({
      where: { id: { in: prontas } },
      data: { estado: "FECHADA", fechadaEm: new Date(), fechadaPorId: rh.sub },
    });

    await recordAudit(rh, {
      action: "folha.fechada_lote",
      entity: "FolhaMensal",
      summary: `Fechou ${prontas.length} folha(s) de ${periodo} em lote`,
      meta: { periodo, fechadas: prontas.length, abertas, porRever },
    });
  }

  revalidatePath("/admin/folhas");
  redirect(
    `/admin/folhas?periodo=${periodo}&fechadas=${prontas.length}&abertas=${abertas}&porRever=${porRever}`,
  );
}

function podeGerirFolhas(session: Session): boolean {
  return session.role === "ADMIN" || session.role === "GESTOR_RH";
}

/** Opens (or returns) the current month's sheet for the signed-in employee. */
export async function abrirMinhaFolha(periodo: Periodo): Promise<string> {
  const session = await requireSession();
  const folha = await garantirFolha(session.sub, periodo);
  return folha.id;
}

/** Today, as the sheet records it. Exported for the activity form's default. */
export async function hojeISO(): Promise<string> {
  return toDia(new Date());
}
