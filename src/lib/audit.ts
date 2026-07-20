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
  | "user.reactivated";

/** Portuguese labels for the audit table and its filter dropdown. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "session.login": "Entrou na conta",
  "session.login_failed": "Tentativa de entrada falhada",
  "session.logout": "Saiu da conta",
  "product.created": "Criou produto",
  "product.updated": "Editou produto",
  "product.deleted": "Apagou produto",
  "case_study.created": "Criou caso de estudo",
  "case_study.updated": "Editou caso de estudo",
  "case_study.deleted": "Apagou caso de estudo",
  "settings.updated": "Alterou definições",
  "quote.status_changed": "Mudou estado de orçamento",
  "invite.created": "Enviou convite",
  "invite.revoked": "Revogou convite",
  "invite.accepted": "Aceitou convite",
  "user.role_changed": "Alterou permissões",
  "user.deactivated": "Desativou utilizador",
  "user.reactivated": "Reativou utilizador",
};

/** Groups actions for the audit page's category filter. */
export const AUDIT_GROUPS: Record<string, AuditAction[]> = {
  Sessões: ["session.login", "session.login_failed", "session.logout"],
  Catálogo: [
    "product.created",
    "product.updated",
    "product.deleted",
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
