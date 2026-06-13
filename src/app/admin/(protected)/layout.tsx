import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/server/actions/auth";
import { DufatLogo } from "@/components/brand/DufatLogo";

export const metadata: Metadata = {
  robots: { index: false },
};

const navigation = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/products", label: "Produtos" },
  { href: "/admin/case-studies", label: "Casos de Estudo" },
  { href: "/admin/quotes", label: "Orçamentos" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-night">
      <header className="border-b border-night-line bg-night-soft">
        <div className="container-site flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" aria-label="Painel de administração">
              <DufatLogo className="h-7" />
            </Link>
            <nav aria-label="Administração" className="hidden gap-5 md:flex">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-white/70 hover:text-dufat-sky"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/50 hover:text-dufat-sky">
              Ver site →
            </Link>
            <span className="hidden text-sm text-white/50 sm:inline">{session.name}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-night-line px-4 py-1.5 text-sm text-white/70 hover:border-dufat-sky/50"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="container-site py-10">{children}</main>
    </div>
  );
}
