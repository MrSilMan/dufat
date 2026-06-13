"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { createSession, destroySession } from "@/lib/auth";
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
    return { ok: false, message: "Credenciais inválidas." };
  }

  await createSession({ sub: user.id, email: user.email, name: user.name });
  logger.info("admin_login_succeeded", { email: user.email });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
