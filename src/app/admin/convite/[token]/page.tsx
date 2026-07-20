import type { Metadata } from "next";
import Link from "next/link";
import { findValidInvite } from "@/lib/invites";
import { getSiteSettings } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/validation";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

export const metadata: Metadata = {
  title: "Aceitar convite — Administração",
  robots: { index: false },
};

/** Invite links are unique per token and must never be cached or prerendered. */
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="admin-shell"
      className="admin-shell relative flex min-h-screen items-center justify-center px-6 py-12"
    >
      <div className="absolute right-5 top-5">
        <ThemeToggle variant="icon" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, settings] = await Promise.all([findValidInvite(token), getSiteSettings()]);

  if (!invite) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <DufatLogo variant="themed" className="h-10" logoUrl={settings.logoUrl} />
          <h1 className="mt-6 font-display text-2xl font-black text-a-text">Convite indisponível</h1>
          <p className="mt-2 text-sm text-a-muted">
            Este convite é inválido, já foi utilizado ou expirou. Peça um novo convite ao
            administrador.
          </p>
          <Link href="/admin/login" className="btn-admin mt-7 px-6 py-2.5">
            Ir para a entrada
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <DufatLogo variant="themed" className="h-10" logoUrl={settings.logoUrl} />
        <span className="mt-5 rounded-full border border-a-accent/25 bg-a-accent-soft px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-a-on-accent-soft">
          Convite
        </span>
        <h1 className="mt-4 font-display text-2xl font-black text-a-text">Olá, {invite.name}</h1>
        <p className="mt-1.5 text-sm text-a-muted">
          {invite.inviterName} convidou-o para a equipa Dufat como{" "}
          <strong className="text-a-text">{ROLE_LABELS[invite.role]}</strong>. Defina uma password
          para activar a conta.
        </p>
      </div>

      <div className="card-admin mt-8 p-7">
        <div className="mb-5 rounded-xl border border-a-line bg-a-inset px-3.5 py-2.5">
          <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">Conta</p>
          <p className="mt-0.5 truncate font-mono text-sm text-a-text">{invite.email}</p>
        </div>
        <AcceptInviteForm token={token} />
      </div>

      <p className="mt-6 text-center text-xs text-a-faint">
        O convite expira a {invite.expiresAt.toLocaleDateString("pt-PT")}.
      </p>
    </Shell>
  );
}
