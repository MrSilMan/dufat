import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "dufat_session";
const SESSION_HOURS = 8;

export type Role = "ADMIN" | "EDITOR";

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
      role: payload.role === "ADMIN" ? "ADMIN" : "EDITOR",
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
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) {
    await destroySession();
    redirect("/admin/login");
  }

  return { sub: user.id, email: user.email, name: user.name, role: user.role };
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
