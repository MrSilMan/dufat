"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { recordAudit, recordAnonymousAudit } from "@/lib/audit";
import { loginSchema, type FormState } from "@/lib/validation";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`login:${ip}`, 10, 900))) {
    return { ok: false, message: "Demasiadas tentativas. Tente novamente mais tarde." };
  }

  const result = loginSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { ok: false, message: "Credenciais inválidas." };
  }

  const user = await prisma.user.findUnique({ where: { email: result.data.email } });
  const valid = user && (await bcrypt.compare(result.data.password, user.passwordHash));
  if (!valid) {
    logger.warn("admin_login_failed", { email: result.data.email, ip });
    await recordAnonymousAudit(
      { email: result.data.email, name: "—", userId: user?.id },
      {
        action: "session.login_failed",
        summary: `Tentativa de entrada falhada para ${result.data.email}`,
      },
    );
    return { ok: false, message: "Credenciais inválidas." };
  }

  // A deactivated user keeps a valid password; the account is what is revoked.
  // The message stays identical to the bad-credentials one so the form cannot
  // be used to enumerate which addresses are real but disabled.
  if (!user.active) {
    logger.warn("admin_login_deactivated", { email: user.email, ip });
    await recordAnonymousAudit(
      { email: user.email, name: user.name, userId: user.id },
      {
        action: "session.login_failed",
        summary: `Entrada bloqueada — conta desativada (${user.email})`,
      },
    );
    return { ok: false, message: "Credenciais inválidas." };
  }

  await createSession({ sub: user.id, email: user.email, name: user.name, role: user.role });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit(
    { sub: user.id, email: user.email, name: user.name },
    { action: "session.login", summary: `${user.name} entrou na conta` },
  );
  logger.info("admin_login_succeeded", { email: user.email, role: user.role });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    await recordAudit(session, {
      action: "session.logout",
      summary: `${session.name} saiu da conta`,
    });
  }
  await destroySession();
  redirect("/admin/login");
}
