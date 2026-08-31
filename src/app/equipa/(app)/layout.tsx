import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { logout } from "@/server/actions/auth";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { IconExternal, IconLogout } from "@/components/admin/icons";
import { EquipaNav } from "@/components/equipa/EquipaNav";
import { EquipaTabBar } from "@/components/equipa/EquipaTabBar";
import { periodoAtual } from "@/lib/award/periodo";

export const metadata: Metadata = { robots: { index: false } };

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join("");
}

/**
 * Shell for the employee area.
 *
 * Reuses the admin design tokens — it is the same product and should not look
 * like a different one — but drops the sidebar of back-office sections.
 *
 * Two navigations, one model: tabs in the header from `md:` up, and a bottom
 * bar within thumb reach below it. The phone is where this app is actually
 * used, so the bottom bar carries the "Registar" action as well as the
 * destinations.
 */
export default async function EquipaLayout({ children }: { children: React.ReactNode }) {
  // Guarded here rather than with requireSession() so an expired session lands
  // on /equipa/entrar — sending an employee to a page titled "Administração"
  // to log back in would be the wrong door twice over.
  const cookieSession = await getSession();
  if (!cookieSession) redirect("/equipa/entrar");

  // Re-read the row: the cookie's role may be stale, and a deactivated account
  // must lose access on the next request rather than at token expiry.
  const user = await prisma.user.findUnique({
    where: { id: cookieSession.sub },
    select: { id: true, name: true, active: true },
  });
  if (!user?.active) redirect("/equipa/entrar");

  // Any signed-in account, not just COLABORADOR: a Gestor de RH who also holds
  // a cargo has a sheet of their own to fill in, and this is where it lives.
  // The asymmetry is deliberate — employees are kept out of /admin, but
  // everyone is welcome in their own area.
  const session = user;
  const settings = await getSiteSettings();

  // A submitted or closed sheet has nothing to add, so the bar drops the action
  // rather than offering a tap that only leads to an explanation.
  const folha = await prisma.folhaMensal.findUnique({
    where: { userId_periodo: { userId: user.id, periodo: periodoAtual() } },
    select: { estado: true },
  });
  const podeRegistar = !folha || folha.estado === "ABERTA";

  return (
    <div id="admin-shell" className="admin-shell flex min-h-screen flex-col">
      <header className="admin-chrome admin-chrome-bottom sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-5 md:px-8">
          <Link
            href="/equipa"
            aria-label="A minha atividade"
            className="flex min-h-11 shrink-0 items-center"
          >
            <DufatLogo variant="themed" className="h-6" logoUrl={settings.logoUrl} />
          </Link>
          <span className="rounded-full border border-a-accent/25 bg-a-accent-soft px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-a-on-accent-soft">
            Equipa
          </span>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle variant="icon" />
            {/* Secondary for someone logging their day — kept off the 360px
                header, where three 44px targets plus the logo do not fit. */}
            <Link
              href="/"
              title="Ver site"
              aria-label="Ver site"
              className="hidden h-11 w-11 items-center justify-center rounded-lg text-a-muted transition-colors hover:bg-a-hover hover:text-a-text sm:flex sm:h-8 sm:w-8"
            >
              <IconExternal className="h-4 w-4" />
            </Link>
            <span
              aria-hidden
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-[0.7rem] font-bold text-white sm:flex"
            >
              {iniciais(session.name)}
            </span>
            <span className="hidden min-w-0 text-sm sm:block">
              <span className="block truncate font-semibold text-a-text">{session.name}</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                title="Sair"
                aria-label="Sair"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-a-muted transition-colors hover:bg-a-hover hover:text-a-text sm:h-8 sm:w-8"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mx-auto hidden w-full max-w-5xl px-5 pb-3 md:block md:px-8">
          <EquipaNav />
        </div>
      </header>

      {/* The bottom bar is fixed, so the page reserves its height plus the
          home-indicator inset — content must never end underneath it. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-10">
        {children}
      </main>

      <EquipaTabBar podeRegistar={podeRegistar} />
    </div>
  );
}
