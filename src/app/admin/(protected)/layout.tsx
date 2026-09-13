import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { acessoRelatorios } from "@/lib/relatorios/acesso";
import { getSiteSettings } from "@/lib/settings";
import { logout } from "@/server/actions/auth";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { IconExternal, IconLogout } from "@/components/admin/icons";

export const metadata: Metadata = {
  robots: { index: false },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

const badgeClass =
  "rounded-full border border-a-accent/25 bg-a-accent-soft px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-a-on-accent-soft";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only authentication here — authorisation belongs to each page. Redirecting
  // by role in the layout would bounce an employee off the one page that is
  // theirs, since it lives inside this same shell.
  const session = await requireSession();
  const [settings, acesso] = await Promise.all([getSiteSettings(), acessoRelatorios(session)]);
  const acessoNav = { registar: acesso.registar, ver: acesso.ver };
  const podeVerOrcamentos = session.role === "ADMIN" || session.role === "EDITOR";
  const newQuotes = podeVerOrcamentos
    ? await prisma.quoteRequest.count({ where: { status: "NEW" } }).catch(() => 0)
    : 0;

  return (
    <div id="admin-shell" className="admin-shell">
      {/* Desktop sidebar */}
      <aside className="admin-chrome fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex">
        <div className="flex h-16 items-center gap-3 px-6">
          <Link href="/admin" aria-label="Painel de administração">
            <DufatLogo variant="themed" className="h-6" logoUrl={settings.logoUrl} />
          </Link>
          <span className={badgeClass}>Admin</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AdminNav newQuotes={newQuotes} role={session.role} acessoRelatorios={acessoNav} />
        </div>

        <div className="space-y-1 p-3">
          <ThemeToggle />
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-a-muted transition-colors hover:bg-a-hover hover:text-a-text"
          >
            <IconExternal className="h-4 w-4 text-a-faint" />
            Ver site
          </Link>
          <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-a-hover">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-xs font-bold text-white"
            >
              {initials(session.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-a-text">{session.name}</p>
              <p className="truncate text-xs text-a-faint">{session.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Sair"
                aria-label="Sair"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-a-faint transition-colors hover:bg-a-hover hover:text-a-text"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <header className="admin-chrome admin-chrome-bottom sticky top-0 z-30 lg:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <Link href="/admin" aria-label="Painel de administração">
                <DufatLogo variant="themed" className="h-5" logoUrl={settings.logoUrl} />
              </Link>
              <span className={badgeClass}>Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle variant="icon" />
              <Link
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-a-muted transition-colors hover:bg-a-hover hover:text-a-text"
                title="Ver site"
                aria-label="Ver site"
              >
                <IconExternal className="h-4 w-4" />
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  title="Sair"
                  aria-label="Sair"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-a-muted transition-colors hover:bg-a-hover hover:text-a-text"
                >
                  <IconLogout className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
          <div className="px-5 pb-3">
            <AdminNav
              variant="bar"
              newQuotes={newQuotes}
              role={session.role}
              acessoRelatorios={acessoNav}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
