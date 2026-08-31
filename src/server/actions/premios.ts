"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";
import { assertAdminRole, assertGestaoRH } from "@/lib/auth";
import { PeriodoConfirmadoError, calcularEGuardarPeriodo } from "@/lib/award/compute";
import { calcularEGuardarAnual } from "@/lib/award/anual";
import { getAwardParametros } from "@/lib/award/settings";
import {
  awardSettingsSchema,
  calcularPeriodoSchema,
  colaboradorSchema,
  confirmarVencedorSchema,
  type FormState,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/**
 * Runs the ranking for a month.
 *
 * Company-wide by default; with `porDepartamento` on, one period per active
 * department, because a single company-wide winner stops being meaningful once
 * headcount is high enough that people never see each other's work.
 */
export async function calcularPeriodo(_prev: FormState, formData: FormData): Promise<FormState> {
  const rh = await assertGestaoRH();

  const result = calcularPeriodoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { periodo } = result.data;

  const parametros = await getAwardParametros();

  try {
    if (parametros.porDepartamento) {
      const departamentos = await prisma.departamento.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { sortOrder: "asc" },
      });
      if (departamentos.length === 0) {
        return {
          ok: false,
          message:
            "O prémio está configurado por departamento, mas não existe nenhum departamento ativo.",
        };
      }
      for (const dep of departamentos) {
        await calcularEGuardarPeriodo({ periodo, departamentoId: dep.id });
      }
      await recordAudit(rh, {
        action: "premio.calculado",
        entity: "AwardPeriod",
        summary: `Calculou o ranking de ${periodo} para ${departamentos.length} departamentos`,
        meta: { periodo, departamentos: departamentos.map((d) => d.nome) },
      });
    } else {
      const { ranking } = await calcularEGuardarPeriodo({ periodo });
      await recordAudit(rh, {
        action: "premio.calculado",
        entity: "AwardPeriod",
        summary: `Calculou o ranking de ${periodo}: ${ranking.elegiveis.length} elegíveis, ${ranking.naoElegiveis.length} não elegíveis`,
        meta: {
          periodo,
          proposto: ranking.proposto?.nome ?? null,
          pontuacao: ranking.proposto?.pontuacaoTotal ?? null,
        },
      });
    }
  } catch (error) {
    if (error instanceof PeriodoConfirmadoError) {
      return { ok: false, message: error.message };
    }
    logger.error("award_calculation_failed", {
      periodo,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Não foi possível calcular o ranking. Tente novamente." };
  }

  revalidatePath("/admin/premios");
  redirect(`/admin/premios?periodo=${periodo}`);
}

/** Runs the Funcionário do Ano standings for a year. */
export async function calcularAnual(_prev: FormState, formData: FormData): Promise<FormState> {
  const rh = await assertGestaoRH();
  const ano = String(formData.get("ano") ?? "");
  if (!/^\d{4}$/.test(ano)) return { ok: false, message: "Ano inválido." };

  try {
    const { linhas } = await calcularEGuardarAnual({ ano });
    if (linhas.length === 0) {
      return {
        ok: false,
        message: `Não há meses confirmados em ${ano}. Confirme pelo menos um mês antes de calcular o prémio anual.`,
      };
    }
    await recordAudit(rh, {
      action: "premio.calculado",
      entity: "AwardPeriod",
      summary: `Calculou o prémio anual de ${ano}: ${linhas.length} colaboradores classificados`,
      meta: { ano, proposto: linhas[0]?.nome ?? null },
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível calcular o prémio anual.",
    };
  }

  revalidatePath("/admin/premios/historico");
  redirect(`/admin/premios?tipo=ANUAL&periodo=${ano}`);
}

/**
 * Confirms the winner and locks the period.
 *
 * The system proposes, the human decides — but an override has to be explained,
 * and the explanation is stored on the period rather than in a comment
 * somewhere, so "why did the second-place candidate win?" is answerable a year
 * later.
 */
export async function confirmarVencedor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await assertAdminRole();

  const result = confirmarVencedorSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { awardPeriodId, vencedorId, notaConfirmacao, motivoOverride } = result.data;

  const period = await prisma.awardPeriod.findUnique({
    where: { id: awardPeriodId },
    select: { id: true, periodo: true, tipo: true, estado: true, propostoId: true },
  });
  if (!period) return { ok: false, message: "Período não encontrado." };
  if (period.estado === "CONFIRMADO") {
    return { ok: false, message: "Este período já foi confirmado." };
  }

  const score = await prisma.awardScore.findUnique({
    where: { awardPeriodId_userId: { awardPeriodId, userId: vencedorId } },
    select: { pontuacaoTotal: true, elegivel: true, user: { select: { name: true } } },
  });
  if (!score) {
    return { ok: false, message: "Esse colaborador não faz parte deste período." };
  }
  if (!score.elegivel) {
    return {
      ok: false,
      message: "Esse colaborador não é elegível neste período. Reveja a lista de não elegíveis.",
    };
  }

  const eOverride = vencedorId !== period.propostoId;
  if (eOverride && !motivoOverride) {
    return {
      ok: false,
      message: "Está a escolher alguém diferente do proposto. Explique porquê.",
      errors: { motivoOverride: ["A justificação é obrigatória quando altera o vencedor."] },
    };
  }

  await prisma.awardPeriod.update({
    where: { id: awardPeriodId },
    data: {
      estado: "CONFIRMADO",
      vencedorId,
      pontuacaoVencedor: score.pontuacaoTotal,
      motivoOverride: eOverride ? motivoOverride! : null,
      notaConfirmacao: notaConfirmacao || null,
      confirmadoPorId: admin.sub,
      confirmadoEm: new Date(),
    },
  });

  await recordAudit(admin, {
    action: "premio.confirmado",
    entity: "AwardPeriod",
    entityId: awardPeriodId,
    summary: eOverride
      ? `Confirmou ${score.user.name} como vencedor de ${period.periodo}, sobrepondo-se à proposta do sistema`
      : `Confirmou ${score.user.name} como vencedor de ${period.periodo}`,
    meta: {
      periodo: period.periodo,
      tipo: period.tipo,
      vencedor: score.user.name,
      pontuacao: Number(score.pontuacaoTotal),
      override: eOverride,
      motivoOverride: eOverride ? motivoOverride : null,
    },
  });

  revalidatePath("/admin/premios");
  revalidatePath("/admin/premios/historico");
  // Confirming is what makes the period visible to employees at all.
  revalidatePath("/equipa/premios");
  return { ok: true, message: `${score.user.name} confirmado como vencedor de ${period.periodo}.` };
}

/**
 * Reopens a confirmed period so it can be recalculated.
 *
 * Admin-only and audited: the award has already been announced by this point,
 * and the results employees were shown are about to change.
 */
export async function reabrirPeriodo(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const id = String(formData.get("awardPeriodId") ?? "");
  if (!id) return;

  const period = await prisma.awardPeriod.findUnique({
    where: { id },
    select: { periodo: true, estado: true, vencedor: { select: { name: true } } },
  });
  if (!period || period.estado !== "CONFIRMADO") return;

  await prisma.awardPeriod.update({
    where: { id },
    data: {
      estado: "CALCULADO",
      vencedorId: null,
      pontuacaoVencedor: null,
      motivoOverride: null,
      notaConfirmacao: null,
      confirmadoPorId: null,
      confirmadoEm: null,
    },
  });

  await recordAudit(admin, {
    action: "premio.reaberto",
    entity: "AwardPeriod",
    entityId: id,
    summary: `Reabriu o período ${period.periodo}, anulando a confirmação de ${period.vencedor?.name ?? "—"}`,
  });

  revalidatePath("/admin/premios");
  revalidatePath("/admin/premios/historico");
  revalidatePath("/equipa/premios");
}

/** Saves the weights, penalties and thresholds. */
export async function guardarDefinicoesPremio(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await assertAdminRole();

  const raw = Object.fromEntries(formData);
  const result = awardSettingsSchema.safeParse({
    ...raw,
    porDepartamento: formData.get("porDepartamento") === "on",
    excluirVencedorAnterior: formData.get("excluirVencedorAnterior") === "on",
  });
  if (!result.success) return validationError(result.error);

  const anterior = await getAwardParametros();

  await prisma.awardSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...result.data },
    update: result.data,
  });

  const alterados = Object.entries(result.data)
    .filter(([key, value]) => anterior[key as keyof typeof anterior] !== value)
    .map(([key]) => key);

  await recordAudit(admin, {
    action: "premio.definicoes_alteradas",
    entity: "AwardSettings",
    entityId: "singleton",
    summary:
      alterados.length > 0
        ? `Alterou os parâmetros do prémio: ${alterados.join(", ")}`
        : "Guardou os parâmetros do prémio sem alterações",
    meta: { alterados, novos: result.data },
  });

  revalidatePath("/admin/premios/definicoes");
  return {
    ok: true,
    message:
      "Parâmetros guardados. Períodos já confirmados mantêm os valores com que foram calculados.",
  };
}

/** Updates the employee side of a user record: cargo, department, dates, photo. */
export async function guardarColaborador(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await assertGestaoRH();

  const result = colaboradorSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, cargoId, departamentoId, dataAdmissao, dataSaida, diasSemana, photoUrl } =
    result.data;

  const alvo = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!alvo) return { ok: false, message: "Colaborador não encontrado." };

  if (dataAdmissao && dataSaida && dataSaida < dataAdmissao) {
    return {
      ok: false,
      message: "A data de saída não pode ser anterior à de admissão.",
      errors: { dataSaida: ["Anterior à data de admissão."] },
    };
  }

  await prisma.user.update({
    where: { id },
    data: {
      cargoId: cargoId || null,
      departamentoId: departamentoId || null,
      dataAdmissao: dataAdmissao ? new Date(`${dataAdmissao}T00:00:00.000Z`) : null,
      dataSaida: dataSaida ? new Date(`${dataSaida}T00:00:00.000Z`) : null,
      diasSemana: diasSemana ?? null,
      photoUrl: photoUrl || null,
    },
  });

  await recordAudit(admin, {
    action: "colaborador.atualizado",
    entity: "User",
    entityId: id,
    summary: `Atualizou a ficha de colaborador de ${alvo.name}`,
    meta: { cargoId, departamentoId, dataAdmissao, dataSaida, diasSemana },
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/colaboradores");
  revalidatePath(`/admin/colaboradores/${id}`);
  return { ok: true, message: "Ficha atualizada." };
}

