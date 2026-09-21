import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Session } from "@/lib/auth";

/**
 * Every audited event. Keeping these as a closed union means a typo becomes a
 * type error instead of an orphaned row the audit filter can never match.
 */
export type AuditAction =
  | "session.login"
  | "session.login_failed"
  | "session.logout"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.invgest_imported"
  | "product.invgest_unlinked"
  | "case_study.created"
  | "case_study.updated"
  | "case_study.deleted"
  | "settings.updated"
  | "quote.status_changed"
  | "invite.created"
  | "invite.revoked"
  | "invite.accepted"
  | "user.role_changed"
  | "user.deactivated"
  | "user.reactivated"
  | "user.password_reset"
  | "user.password_changed"
  | "colaborador.atualizado"
  | "atividade.validada"
  | "atividade.questionada"
  | "atividade.rejeitada"
  | "atividade.reaberta"
  | "folha.submetida"
  | "folha.fechada"
  | "folha.fechada_lote"
  | "folha.reaberta"
  | "premio.calculado"
  | "premio.confirmado"
  | "premio.reaberto"
  | "premio.definicoes_alteradas"
  | "organizacao.cargo_criado"
  | "organizacao.cargo_atualizado"
  | "organizacao.cargo_desativado"
  | "organizacao.departamento_criado"
  | "organizacao.departamento_atualizado"
  | "organizacao.departamento_desativado"
  | "organizacao.categoria_criada"
  | "organizacao.categoria_atualizada"
  | "organizacao.categoria_desativada"
  | "metodo_pagamento.criado"
  | "metodo_pagamento.atualizado"
  | "metodo_pagamento.desativado"
  | "metodo_pagamento.reativado"
  | "relatorio.finalizado"
  | "relatorio.reaberto"
  | "relatorio.data_alterada"
  | "relatorio.acesso_alterado";

/** Portuguese labels for the audit table and its filter dropdown. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "session.login": "Entrou na conta",
  "session.login_failed": "Tentativa de entrada falhada",
  "session.logout": "Saiu da conta",
  "product.created": "Criou produto",
  "product.updated": "Editou produto",
  "product.deleted": "Apagou produto",
  "product.invgest_imported": "Importou produtos da INVGEST",
  "product.invgest_unlinked": "Desassociou produto da INVGEST",
  "case_study.created": "Criou caso de estudo",
  "case_study.updated": "Editou caso de estudo",
  "case_study.deleted": "Apagou caso de estudo",
  "settings.updated": "Alterou definições",
  "quote.status_changed": "Mudou estado de orçamento",
  "invite.created": "Enviou convite",
  "invite.revoked": "Revogou convite",
  "invite.accepted": "Aceitou convite",
  "user.role_changed": "Alterou permissões",
  "user.password_reset": "Repôs palavra-passe",
  "user.password_changed": "Definiu nova palavra-passe",
  "user.deactivated": "Desativou utilizador",
  "user.reactivated": "Reativou utilizador",
  "colaborador.atualizado": "Atualizou ficha de colaborador",
  "atividade.validada": "Validou atividade",
  "atividade.questionada": "Pediu justificação de atividade",
  "atividade.rejeitada": "Rejeitou atividade",
  "atividade.reaberta": "Reabriu atividade",
  "folha.submetida": "Submeteu folha de atividade",
  "folha.fechada": "Fechou folha de atividade",
  "folha.fechada_lote": "Fechou folhas do mês em lote",
  "folha.reaberta": "Reabriu folha de atividade",
  "premio.calculado": "Calculou ranking do prémio",
  "premio.confirmado": "Confirmou vencedor do prémio",
  "premio.reaberto": "Reabriu período do prémio",
  "premio.definicoes_alteradas": "Alterou parâmetros do prémio",
  "organizacao.cargo_criado": "Criou cargo",
  "organizacao.cargo_atualizado": "Editou cargo",
  "organizacao.cargo_desativado": "Desativou cargo",
  "organizacao.departamento_criado": "Criou departamento",
  "organizacao.departamento_atualizado": "Editou departamento",
  "organizacao.departamento_desativado": "Desativou departamento",
  "organizacao.categoria_criada": "Criou categoria de atividade",
  "organizacao.categoria_atualizada": "Editou categoria de atividade",
  "organizacao.categoria_desativada": "Desativou categoria de atividade",
  "metodo_pagamento.criado": "Criou método de pagamento",
  "metodo_pagamento.atualizado": "Editou método de pagamento",
  "metodo_pagamento.desativado": "Desativou método de pagamento",
  "metodo_pagamento.reativado": "Reativou método de pagamento",
  "relatorio.finalizado": "Finalizou relatório diário",
  "relatorio.reaberto": "Reabriu relatório diário",
  "relatorio.data_alterada": "Mudou a data de relatório diário",
  "relatorio.acesso_alterado": "Alterou acesso aos relatórios",
};

/** Groups actions for the audit page's category filter. */
export const AUDIT_GROUPS: Record<string, AuditAction[]> = {
  Sessões: ["session.login", "session.login_failed", "session.logout"],
  Catálogo: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product.invgest_imported",
    "product.invgest_unlinked",
    "case_study.created",
    "case_study.updated",
    "case_study.deleted",
  ],
  Definições: ["settings.updated"],
  Orçamentos: ["quote.status_changed"],
  Equipa: [
    "invite.created",
    "invite.revoked",
    "invite.accepted",
    "user.role_changed",
    "user.deactivated",
    "user.reactivated",
    "colaborador.atualizado",
  ],
  "Folhas de atividade": [
    "atividade.validada",
    "atividade.questionada",
    "atividade.rejeitada",
    "atividade.reaberta",
    "folha.submetida",
    "folha.fechada",
    "folha.fechada_lote",
    "folha.reaberta",
  ],
  Prémios: [
    "premio.calculado",
    "premio.confirmado",
    "premio.reaberto",
    "premio.definicoes_alteradas",
  ],
  Organização: [
    "organizacao.cargo_criado",
    "organizacao.cargo_atualizado",
    "organizacao.cargo_desativado",
    "organizacao.departamento_criado",
    "organizacao.departamento_atualizado",
    "organizacao.departamento_desativado",
    "organizacao.categoria_criada",
    "organizacao.categoria_atualizada",
    "organizacao.categoria_desativada",
  ],
  // Individual line edits live in RelatorioHistorico, written in the same
  // transaction as the change; only the report's lifecycle is mirrored here.
  "Relatórios diários": [
    "metodo_pagamento.criado",
    "metodo_pagamento.atualizado",
    "metodo_pagamento.desativado",
    "metodo_pagamento.reativado",
    "relatorio.finalizado",
    "relatorio.reaberto",
    "relatorio.data_alterada",
    "relatorio.acesso_alterado",
  ],
};

type AuditActor = Pick<Session, "sub" | "email" | "name">;

type RecordInput = {
  action: AuditAction;
  summary: string;
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
};

/** Best-effort client IP from the proxy headers. */
async function clientIp(): Promise<string | null> {
  try {
    const store = await headers();
    return (
      store.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      store.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Appends an entry to the audit trail.
 *
 * Never throws: an audit write must not roll back or fail the action it is
 * recording. A failure here is logged for operators instead.
 */
export async function recordAudit(actor: AuditActor, input: RecordInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        summary: input.summary,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        meta: input.meta,
        ip: await clientIp(),
        userId: actor.sub,
        userEmail: actor.email,
        userName: actor.name,
      },
    });
  } catch (error) {
    logger.error("audit_write_failed", {
      action: input.action,
      by: actor.email,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Audit entry for someone who has no session yet (a failed login, or an invite
 * being accepted before the account exists).
 */
export async function recordAnonymousAudit(
  identity: { email: string; name: string; userId?: string },
  input: RecordInput,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        summary: input.summary,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        meta: input.meta,
        ip: await clientIp(),
        userId: identity.userId ?? null,
        userEmail: identity.email,
        userName: identity.name,
      },
    });
  } catch (error) {
    logger.error("audit_write_failed", {
      action: input.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
