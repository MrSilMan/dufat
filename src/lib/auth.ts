import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "dufat_session";
const SESSION_HOURS = 8;

export type Role = "ADMIN" | "GESTOR_RH" | "EDITOR" | "COLABORADOR";

const ROLES: readonly Role[] = ["ADMIN", "GESTOR_RH", "EDITOR", "COLABORADOR"];

/** Roles that belong in the back-office shell at all. */
const ROLES_BACKOFFICE: readonly Role[] = ["ADMIN", "GESTOR_RH", "EDITOR"];
/** Roles that may see other people's award scores. */
const ROLES_RH: readonly Role[] = ["ADMIN", "GESTOR_RH"];
/** Roles that may edit the public site: catalogue, case studies, quotes. */
const ROLES_CATALOGO: readonly Role[] = ["ADMIN", "EDITOR"];

function coerceRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "COLABORADOR";
}

export type Session = {
  sub: string;
  email: string;
  name: string;
  role: Role;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set to a string of at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Decodes the session cookie. The JWT is only proof of *identity*; the role it
 * carries may be stale, so never authorize from it — use requireAdmin(), which
 * re-reads the user row.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Session>(token, getSecret());
    return {
      sub: payload.sub!,
      email: payload.email,
      name: payload.name,
      role: coerceRole(payload.role),
    };
  } catch {
    return null;
  }
}

/**
 * Server-side guard for admin pages and actions.
 *
 * Re-reads the user on every call so a role change, deactivation or deletion
 * takes effect on the next request instead of lingering for the 8-hour life of
 * an already-issued token.
 */
export async function requireSession(loginPath = "/admin/login"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(loginPath);

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      mustChangePassword: true,
    },
  });
  if (!user || !user.active) {
    await destroySession();
    redirect(loginPath);
  }

  // A password an admin chose and read out loud is a shared secret, so it opens
  // exactly one door: the one that replaces it. Enforced on the row rather than
  // in the session token, so a reset takes hold on the next request even for
  // someone already signed in.
  if (user.mustChangePassword) redirect(caminhoReporPassword(user.role));

  return { sub: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Guard for the back-office: the catalogue, quotes, settings and team screens.
 *
 * Employees (COLABORADOR) are authenticated but have no business here, so they
 * are sent to their own area rather than to a login form they have already
 * passed.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!ROLES_BACKOFFICE.includes(session.role)) redirect(areaInicial(session.role));
  return session;
}

/**
 * Guard for the catalogue side of the back-office.
 *
 * The Gestor de RH belongs in the back-office but not in the product catalogue,
 * and hiding the nav link alone would leave the pages reachable by URL.
 */
export async function requireCatalogo(): Promise<Session> {
  const session = await requireAdmin();
  if (!ROLES_CATALOGO.includes(session.role)) redirect("/admin/premios");
  return session;
}

/**
 * Guard for admin-only surfaces (team, audit, deletions, branding).
 *
 * Editors are sent to the dashboard rather than the login page: they are
 * authenticated, just not authorized, and bouncing them to a login form they
 * have already passed would be a dead end.
 */
export async function requireAdminRole(): Promise<Session> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") redirect("/admin?denied=1");
  return session;
}

/** Non-redirecting variant for server actions that must fail, not navigate. */
export async function assertAdminRole(): Promise<Session> {
  const session = await requireAdmin();
  if (session.role !== "ADMIN") {
    throw new Error("Forbidden: esta ação requer permissões de administrador.");
  }
  return session;
}

/**
 * Guard for the award ranking, where every employee's score is on screen.
 *
 * The Gestor de RH runs the award but has no reason to touch site settings, so
 * this sits deliberately between requireAdmin() and requireAdminRole().
 */
export async function requireGestaoRH(): Promise<Session> {
  const session = await requireSession();
  if (!ROLES_RH.includes(session.role)) redirect("/admin?denied=1");
  return session;
}

/** Non-redirecting variant of {@link requireGestaoRH} for server actions. */
export async function assertGestaoRH(): Promise<Session> {
  const session = await requireSession();
  if (!ROLES_RH.includes(session.role)) {
    throw new Error("Forbidden: esta ação requer permissões de RH ou de administrador.");
  }
  return session;
}

/**
 * Whether this role has a back-office to return to.
 *
 * Mirrors requireAdmin(): the "Administração" link in the employee header is
 * only shown to people the guard would actually let in, so nobody is offered a
 * door that bounces them straight back.
 */
export function podeVerBackoffice(role: Role): boolean {
  return ROLES_BACKOFFICE.includes(role);
}

export function podeVerTodosOsScores(role: Role): boolean {
  return ROLES_RH.includes(role);
}

/**
 * Where a role belongs after signing in or accepting an invite.
 *
 * One definition, used by the login action, the invite flow and every guard, so
 * an employee can never be bounced into the back-office by one path while being
 * redirected out of it by another.
 */
export function areaInicial(role: Role): string {
  return role === "COLABORADOR" ? "/equipa" : "/admin";
}

/**
 * Where someone carrying an admin-set temporary password must go first.
 *
 * Split by role for the same reason as {@link areaInicial}: an employee should
 * never be shown a page badged "Administração". Both routes sit outside their
 * area's guarded layout, or the guard that sends people here would send them
 * here again on arrival.
 */
export function caminhoReporPassword(role: Role): string {
  return role === "COLABORADOR" ? "/equipa/repor" : "/admin/repor";
}

// ---------- Invite tokens ----------

export const INVITE_TTL_DAYS = 7;

/** URL-safe secret handed to the invitee. Only ever exists in the invite link. */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * SHA-256 of the raw token — what we store. A plain hash (not bcrypt) is right
 * here: the token is 256 bits of entropy, so there is nothing to brute-force,
 * and lookup must be an indexed exact match.
 */
export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
