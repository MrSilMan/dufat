import type { Metadata } from "next";
import Link from "next/link";
import { findValidInvite } from "@/lib/invites";
import { getSiteSettings } from "@/lib/settings";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

export const metadata: Metadata = {
  title: "Aceitar convite — Equipa Dufat",
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

/**
 * Where a new employee sets their password.
 *
 * The same flow as the admin invite page, but it shows the cargo and department
 * they are being taken on as: the first thing someone sees of a system that
 * will score their work should tell them how they have been classified, since
 * that is exactly what decides who they are measured against.
 */
export default async function AceitarConviteEquipaPage({
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
          <h1 className="mt-6 font-display text-2xl font-black text-a-text">
            Convite indisponível
          </h1>
          <p className="mt-2 text-sm text-a-muted">
            Este convite é inválido, já foi utilizado ou expirou. Peça um novo ao Gestor de
            Recursos Humanos.
          </p>
          <Link href="/equipa/entrar" className="btn-admin mt-7 px-6 py-2.5">
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
          Equipa
        </span>
        <h1 className="mt-4 font-display text-2xl font-black text-a-text">Olá, {invite.name}</h1>
        <p className="mt-1.5 text-sm text-a-muted">
          {invite.inviterName} registou-o na equipa Dufat. Defina uma password para activar a
          conta e começar a registar a sua atividade.
        </p>
      </div>

      <div className="card-admin mt-8 p-7">
        <div className="mb-5 space-y-2.5 rounded-xl border border-a-line bg-a-inset px-3.5 py-3">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">
              Conta
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-a-text">{invite.email}</p>
          </div>
          {invite.cargoNome && (
            <div>
              <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">
                Cargo
              </p>
              <p className="mt-0.5 text-sm text-a-text">
                {invite.cargoNome}
                {invite.departamentoNome && (
                  <span className="text-a-muted"> · {invite.departamentoNome}</span>
                )}
              </p>
            </div>
          )}
        </div>
        <AcceptInviteForm token={token} />
      </div>

      <p className="mt-6 text-center text-xs text-a-faint">
        O convite expira a {invite.expiresAt.toLocaleDateString("pt-PT")}.
      </p>
    </Shell>
  );
}
