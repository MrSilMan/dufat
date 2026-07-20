import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

export const metadata: Metadata = {
  title: "Entrar — Administração",
  robots: { index: false },
};

export default async function AdminLoginPage() {
  if (await getSession()) redirect("/admin");

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
          <DufatLogo variant="themed" className="h-10" />
          <span className="mt-5 rounded-full border border-a-accent/25 bg-a-accent-soft px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-a-on-accent-soft">
            Administração
          </span>
          <h1 className="mt-4 font-display text-2xl font-black text-a-text">Bem-vindo de volta</h1>
          <p className="mt-1.5 text-sm text-a-muted">Acesso reservado à equipa Dufat</p>
        </div>
        <div className="card-admin mt-8 p-7">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-a-faint">
          Dufat, Lda. — Iluminação Pública e Material Elétrico
        </p>
      </div>
    </div>
  );
}
