import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { DufatLogo } from "@/components/brand/DufatLogo";

export const metadata: Metadata = {
  title: "Entrar — Administração",
  robots: { index: false },
};

export default async function AdminLoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-night px-6">
      <div className="w-full max-w-sm">
        <DufatLogo className="mx-auto h-10" />
        <h1 className="mt-6 text-center text-2xl font-extrabold">Administração</h1>
        <p className="mt-1 text-center text-sm text-white/50">Acesso reservado à equipa Dufat</p>
        <div className="card-night mt-8 p-7">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
