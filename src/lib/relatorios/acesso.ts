import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, type Role, type Session } from "@/lib/auth";

/**
 * Who may use the daily reports, decided per person by the Administrador.
 *
 *   registar — keeps their own daily reports;
 *   ver      — reads everyone's reports (drafts and history included), read-only.
 *
 * Nobody has either until the admin says so, and someone with neither must not
 * learn the feature exists: no tab, no link, and a 404 on every report URL —
 * never a "no permission" page that confirms what is behind it.
 *
 * The Administrador always has both; granting is how everyone else gets in.
 */
export type AcessoRelatorios = {
  registar: boolean;
  ver: boolean;
  admin: boolean;
};

const SEM_ACESSO: AcessoRelatorios = { registar: false, ver: false, admin: false };

/** From a user row already loaded — for layouts that select it anyway. */
export function resolverAcesso(user: {
  role: Role;
  active?: boolean;
  podeRegistarRelatorios: boolean;
  podeVerRelatorios: boolean;
}): AcessoRelatorios {
  if (user.active === false) return SEM_ACESSO;
  if (user.role === "ADMIN") return { registar: true, ver: true, admin: true };
  return { registar: user.podeRegistarRelatorios, ver: user.podeVerRelatorios, admin: false };
}

/**
 * Reads the grants fresh on every call, like `requireSession` does the role, so
 * removing someone's access takes hold on their next request.
 */
export async function acessoRelatorios(session: Pick<Session, "sub" | "role">): Promise<AcessoRelatorios> {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true, active: true, podeRegistarRelatorios: true, podeVerRelatorios: true },
  });
  return user ? resolverAcesso(user) : SEM_ACESSO;
}

export function temAcesso(acesso: AcessoRelatorios): boolean {
  return acesso.registar || acesso.ver;
}

/** A report is visible to viewers and admins, and to its author while they may still keep reports. */
export function podeVerRelatorio(
  session: Pick<Session, "sub">,
  acesso: AcessoRelatorios,
  autorId: string,
): boolean {
  return acesso.admin || acesso.ver || (acesso.registar && session.sub === autorId);
}

/** Page guard for the report screens: without any grant, the pages do not exist. */
export async function requireAcessoRelatorios(): Promise<{
  session: Session;
  acesso: AcessoRelatorios;
}> {
  const session = await requireSession("/equipa/entrar");
  const acesso = await acessoRelatorios(session);
  if (!temAcesso(acesso)) notFound();
  return { session, acesso };
}
