import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { areaInicial, getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { LoginForm } from "@/components/admin/LoginForm";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

export const metadata: Metadata = {
  title: "Entrar — Equipa Dufat",
  robots: { index: false },
};

/**
 * The employees' front door.
 *
 * Same session and same login action as /admin/login — one account per person,
 * not two — but a separate page, because "Administração" is the wrong word to
 * greet someone whose job here is recording the work they did today. The login
 * action routes by role, so an admin who lands here still ends up in /admin.
 */
export default async function EntrarEquipaPage() {
  const session = await getSession();
  if (session) redirect(areaInicial(session.role));
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
            Equipa
          </span>
          <h1 className="mt-4 font-display text-2xl font-black text-a-text">A minha atividade</h1>
          <p className="mt-1.5 text-sm text-a-muted">
            Registe o seu trabalho e acompanhe a sua pontuação.
          </p>
        </div>

        <div className="card-admin mt-8 p-7">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-a-faint">
          Não tem acesso? Fale com o Gestor de Recursos Humanos.
        </p>
      </div>
    </div>
  );
}
