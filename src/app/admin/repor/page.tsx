import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, areaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

export const metadata: Metadata = {
  title: "Nova palavra-passe — Dufat",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a temporary password set by an admin gets replaced.
 *
 * Sits outside the guarded /admin layout on purpose: that layout redirects
 * anyone carrying `mustChangePassword` to this page, so a page inside it would
 * redirect to itself forever.
 */
export default async function ReporPasswordAdminPage() {
  const cookieSession = await getSession();
  if (!cookieSession) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: cookieSession.sub },
    select: { name: true, email: true, role: true, active: true, mustChangePassword: true },
  });
  if (!user?.active) redirect("/admin/login");

  // Reached without a pending reset — nothing to do here, so hand them back
  // their own area rather than an empty form.
  if (!user.mustChangePassword) redirect(areaInicial(user.role));

  const settings = await getSiteSettings();

  return (
    <div
      id="admin-shell"
      className="admin-shell relative flex min-h-screen items-center justify-center px-6 py-12"
    >
      <div className="absolute right-5 top-5">
        <ThemeToggle variant="icon" />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <DufatLogo variant="themed" className="h-10" logoUrl={settings.logoUrl} />
          <span className="mt-5 rounded-full border border-a-accent/25 bg-a-accent-soft px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-a-on-accent-soft">
            Administração
          </span>
          <h1 className="mt-4 font-display text-2xl font-black text-a-text">
            Olá, {user.name}
          </h1>
          <p className="mt-1.5 text-sm text-a-muted">
            A sua palavra-passe foi reposta por um administrador. Defina uma nova, que só
            você conhece, para continuar.
          </p>
        </div>

        <div className="card-admin mt-8 p-7">
          <div className="mb-5 rounded-xl border border-a-line bg-a-inset px-3.5 py-3">
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">
              Conta
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-a-text">{user.email}</p>
          </div>
          <ChangePasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-a-faint">
          A palavra-passe temporária deixa de funcionar assim que guardar a nova.
        </p>
      </div>
    </div>
  );
}
