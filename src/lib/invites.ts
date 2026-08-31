import "server-only";
import { prisma } from "@/lib/db";
import { hashInviteToken, type Role } from "@/lib/auth";

/** What the invite-acceptance page may safely render. Never the token hash. */
export type ValidInvite = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdById: string;
  inviterName: string;
  expiresAt: Date;
  /** Set for employee invites; shown on the acceptance page so the person can
   *  see the cargo they are being taken on as before committing a password. */
  cargoNome: string | null;
  departamentoNome: string | null;
  /** Copied onto the User when the invite is accepted. */
  cargoId: string | null;
  departamentoId: string | null;
  dataAdmissao: Date | null;
  diasSemana: number | null;
};

/**
 * Resolves a raw invite token to a pending, unexpired invite.
 *
 * Returns null for every failure mode (unknown, revoked, already accepted,
 * expired) so the acceptance page cannot be used to probe which addresses have
 * been invited.
 */
export async function findValidInvite(token: string): Promise<ValidInvite | null> {
  if (!token) return null;

  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      expiresAt: true,
      createdById: true,
      createdBy: { select: { name: true } },
      cargoId: true,
      departamentoId: true,
      dataAdmissao: true,
      diasSemana: true,
      cargo: { select: { nome: true } },
      departamento: { select: { nome: true } },
    },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) return null;

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    createdById: invite.createdById,
    inviterName: invite.createdBy.name,
    expiresAt: invite.expiresAt,
    cargoNome: invite.cargo?.nome ?? null,
    departamentoNome: invite.departamento?.nome ?? null,
    cargoId: invite.cargoId,
    departamentoId: invite.departamentoId,
    dataAdmissao: invite.dataAdmissao,
    diasSemana: invite.diasSemana,
  };
}
