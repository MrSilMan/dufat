"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { recordAudit, recordAnonymousAudit } from "@/lib/audit";
import {
  areaInicial,
  assertAdminRole,
  assertGestaoRH,
  createSession,
  generateInviteToken,
  hashInviteToken,
  INVITE_TTL_DAYS,
} from "@/lib/auth";
import { inviteEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { findValidInvite } from "@/lib/invites";
import {
  acceptInviteSchema,
  inviteIdSchema,
  inviteSchema,
  ROLE_LABELS,
  userActiveSchema,
  userRoleSchema,
  type FormState,
  type InviteFormState,
  type RoleValue,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/**
 * Where an invitee sets their password.
 *
 * Employees are sent to the /equipa area rather than /admin: their first
 * experience of the system should not be a page titled "Administração" for a
 * back-office they will never be allowed into.
 */
function inviteUrlFor(token: string, role: RoleValue): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const area = role === "COLABORADOR" ? "equipa" : "admin";
  return `${base.replace(/\/$/, "")}/${area}/convite/${token}`;
}

// ---------- Invites ----------

export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  // Registering staff is the Gestor de RH's job, so they may invite — but only
  // as COLABORADOR. Letting them mint an ADMIN would make "Gestor de RH" a
  // one-step path to full control of the site.
  const admin = await assertGestaoRH();

  const result = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);

  if (admin.role !== "ADMIN" && result.data.role !== "COLABORADOR") {
    return {
      ok: false,
      message: "Só um Administrador pode conceder permissões acima de Colaborador.",
      errors: { role: ["Apenas o Administrador atribui estas permissões."] },
    };
  }
  const { name, email, role, cargoId, departamentoId, dataAdmissao, diasSemana } =
    result.data;

  // An account already exists: re-inviting would either be a no-op or a way to
  // silently reset someone's access, so refuse and say why.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      message: existing.active
        ? "Este email já pertence a um membro da equipa."
        : "Este email pertence a um utilizador desativado. Reative-o em vez de convidar.",
      errors: { email: ["Já existe uma conta com este email."] },
    };
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  let inviteId: string;
  try {
    // Supersede any earlier pending invite for this address so only the newest
    // link works — otherwise revoking the visible invite would leave older
    // links alive.
    await prisma.invite.updateMany({
      where: { email, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    const invite = await prisma.invite.create({
      data: {
        email,
        name,
        role,
        tokenHash: hashInviteToken(token),
        expiresAt,
        createdById: admin.sub,
        cargoId: cargoId || null,
        departamentoId: departamentoId || null,
        dataAdmissao: dataAdmissao ? new Date(`${dataAdmissao}T00:00:00.000Z`) : null,
        diasSemana: diasSemana ?? null,
      },
    });
    inviteId = invite.id;
  } catch (error) {
    logger.error("invite_create_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Erro ao criar o convite. Tente novamente." };
  }

  const url = inviteUrlFor(token, role);
  await recordAudit(admin, {
    action: "invite.created",
    entity: "Invite",
    entityId: inviteId,
    summary: `Convidou ${name} (${email}) como ${ROLE_LABELS[role]}`,
    meta: { email, role, cargoId, departamentoId },
  });
  revalidatePath("/admin/team");

  const cargoLabel = cargoId
    ? (await prisma.cargo.findUnique({ where: { id: cargoId }, select: { nome: true } }))?.nome ??
      null
    : null;

  const mail = inviteEmail({
    name,
    inviterName: admin.name,
    roleLabel: ROLE_LABELS[role],
    url,
    expiresInDays: INVITE_TTL_DAYS,
    colaborador: role === "COLABORADOR",
    cargoLabel,
  });
  const sent = await sendMail({ to: email, ...mail });

  if (sent.ok) {
    return { ok: true, message: `Convite enviado para ${email}.` };
  }

  // Email is best-effort: the invite is already valid, so hand the admin the
  // link rather than losing the work.
  return {
    ok: true,
    inviteUrl: url,
    message: isMailConfigured()
      ? "Convite criado, mas o email não foi enviado. Partilhe o link abaixo."
      : "Convite criado. O envio de email não está configurado — partilhe o link abaixo.",
  };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const result = inviteIdSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;

  const invite = await prisma.invite.findUnique({ where: { id: result.data.id } });
  if (!invite || invite.status !== "PENDING") return;

  await prisma.invite.update({ where: { id: invite.id }, data: { status: "REVOKED" } });
  await recordAudit(admin, {
    action: "invite.revoked",
    entity: "Invite",
    entityId: invite.id,
    summary: `Revogou o convite de ${invite.name} (${invite.email})`,
    meta: { email: invite.email },
  });
  revalidatePath("/admin/team");
}

/**
 * Accepts an invite: creates the user, consumes the invite and signs them in.
 * Public (no session required) — the token is the credential.
 */
export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = acceptInviteSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { token, password } = parsed.data;

  // Throttle guessing at the token endpoint even though tokens are 256-bit.
  if (!(await rateLimit(`invite-accept:${hashInviteToken(token).slice(0, 16)}`, 10, 900))) {
    return { ok: false, message: "Demasiadas tentativas. Tente novamente mais tarde." };
  }

  const invite = await findValidInvite(token);
  if (!invite) {
    return { ok: false, message: "Este convite é inválido, expirou ou já foi utilizado." };
  }
  if (await prisma.user.findUnique({ where: { email: invite.email } })) {
    return { ok: false, message: "Já existe uma conta com este email." };
  }

  let user;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    // One transaction: a created user with a still-pending invite would let the
    // same link be replayed.
    [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          passwordHash,
          role: invite.role,
          invitedById: invite.createdById,
          // The ficha travels with the invite, so a new employee is scoreable
          // from their first logged activity rather than after someone
          // remembers to go back and fill it in.
          cargoId: invite.cargoId,
          departamentoId: invite.departamentoId,
          dataAdmissao: invite.dataAdmissao,
          diasSemana: invite.diasSemana,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      }),
    ]);
  } catch (error) {
    logger.error("invite_accept_failed", {
      email: invite.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Erro ao criar a conta. Tente novamente." };
  }

  await recordAnonymousAudit(
    { email: user.email, name: user.name, userId: user.id },
    {
      action: "invite.accepted",
      entity: "User",
      entityId: user.id,
      summary: `${user.name} aceitou o convite e criou a conta (${ROLE_LABELS[user.role]})`,
      meta: { role: user.role },
    },
  );
  logger.info("invite_accepted", { email: user.email, role: user.role });

  await createSession({ sub: user.id, email: user.email, name: user.name, role: user.role });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect(areaInicial(user.role));
}

// ---------- Members ----------

export async function changeUserRole(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const result = userRoleSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;

  const target = await prisma.user.findUnique({ where: { id: result.data.id } });
  if (!target || target.role === result.data.role) return;

  // Guard against locking the organisation out of its own admin surface.
  if (target.role === "ADMIN" && result.data.role !== "ADMIN" && (await isLastAdmin(target.id))) {
    return;
  }

  await prisma.user.update({ where: { id: target.id }, data: { role: result.data.role } });
  await recordAudit(admin, {
    action: "user.role_changed",
    entity: "User",
    entityId: target.id,
    summary: `Alterou ${target.name} de ${ROLE_LABELS[target.role]} para ${ROLE_LABELS[result.data.role]}`,
    meta: { from: target.role, to: result.data.role, email: target.email },
  });
  revalidatePath("/admin/team");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const result = userActiveSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;

  const target = await prisma.user.findUnique({ where: { id: result.data.id } });
  if (!target || target.active === result.data.active) return;

  // Deactivating yourself, or the last admin, would strand the account.
  if (!result.data.active) {
    if (target.id === admin.sub) return;
    if (target.role === "ADMIN" && (await isLastAdmin(target.id))) return;
  }

  await prisma.user.update({ where: { id: target.id }, data: { active: result.data.active } });
  await recordAudit(admin, {
    action: result.data.active ? "user.reactivated" : "user.deactivated",
    entity: "User",
    entityId: target.id,
    summary: `${result.data.active ? "Reativou" : "Desativou"} ${target.name} (${target.email})`,
    meta: { email: target.email },
  });
  revalidatePath("/admin/team");
}

/** True when `userId` is the only remaining active admin. */
async function isLastAdmin(userId: string): Promise<boolean> {
  const others = await prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: userId } },
  });
  return others === 0;
}
