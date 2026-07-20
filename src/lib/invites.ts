import "server-only";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/auth";

/** What the invite-acceptance page may safely render. Never the token hash. */
export type ValidInvite = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR";
  createdById: string;
  inviterName: string;
  expiresAt: Date;
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
  };
}
