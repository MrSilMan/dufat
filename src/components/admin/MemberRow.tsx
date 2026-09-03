"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { setUserActive } from "@/server/actions/team";
import { ActiveBadge, RoleBadge } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { ROLE_HINTS, type RoleValue } from "@/lib/validation";

/**
 * One member, already formatted. Dates arrive as strings because they are
 * rendered identically on both sides of the boundary that way — a Date crossing
 * it would be formatted in the browser's locale and hydrate differently.
 */
export type MembroVista = {
  id: string;
  name: string;
  email: string;
  role: RoleValue;
  active: boolean;
  iniciais: string;
  ultimaEntrada: string;
  membroDesde: string;
  convidadoPor: string | null;
  isSelf: boolean;
  /** Why role and access are locked on this row, when they are. */
  motivoBloqueio?: string;
};

function Facto({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-a-text">{value}</dd>
    </div>
  );
}

function Seccao({
  titulo,
  hint,
  children,
}: {
  titulo: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-a-line px-6 py-5">
      <h3 className="text-sm font-semibold text-a-text">{titulo}</h3>
      <p className="mt-0.5 text-xs text-a-muted">{hint}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * A member row, and the panel that manages that member.
 *
 * The table used to carry a role dropdown, a reset-password form and a
 * deactivate button in every row — three live controls per person, wrapping
 * into three lines each on a normal window, so a list whose job is "who has
 * access" was mostly a wall of buttons. The row now states the facts and
 * nothing else; everything you can *do* to an account lives one click away,
 * where each action has room for the sentence explaining what it does.
 */
export function MemberRow({ membro }: { membro: MembroVista }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  // <tbody> may only contain <tr> — a <dialog> rendered as its sibling here is
  // invalid HTML, and the browser silently relocates it while parsing the
  // server response, before React ever gets to hydrate. Portaling sidesteps the
  // table entirely. `montado` stays false through the server render and the
  // first client render (same subscription never fires, so there is nothing to
  // resubscribe to), then flips true once React commits — the same "only
  // exists on the client" read ThemeToggle uses for the saved theme, chosen
  // over an effect that calls setState to avoid the extra render that pattern
  // causes.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  // Clicking the backdrop lands on the <dialog> itself; inner content stops there.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) setAberto(false);
  };

  const bloqueado = Boolean(membro.motivoBloqueio);
  const avatar = (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-xs font-bold text-white"
    >
      {membro.iniciais}
    </span>
  );

  return (
    <>
      <tr>
        <td className="px-5 py-3">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            className="group flex w-full items-center gap-3.5 rounded-xl p-1 text-left transition-colors hover:bg-a-hover"
          >
            {avatar}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-a-text group-hover:text-a-accent">
                {membro.name}
                {membro.isSelf && (
                  <span className="ml-2 text-xs font-normal text-a-faint">(você)</span>
                )}
              </span>
              <span className="block truncate font-mono text-xs text-a-faint">{membro.email}</span>
            </span>
          </button>
        </td>
        <td className="px-5 py-3">
          <RoleBadge role={membro.role} />
        </td>
        <td className="px-5 py-3">
          <ActiveBadge active={membro.active} />
        </td>
        <td className="hidden px-5 py-3 lg:table-cell">
          <span className="font-mono text-xs text-a-muted">{membro.ultimaEntrada}</span>
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
          >
            Gerir
          </button>
        </td>
      </tr>

      {/* Portaled into #admin-shell, not document.body: every `--a-*` colour
          token the dialog's own styling depends on is scoped to that element,
          not :root, so a portal past it renders an invisible, colourless box. */}
      {montado &&
        createPortal(
          <dialog
            ref={dialogRef}
            onClose={() => setAberto(false)}
            onClick={onBackdropClick}
            aria-labelledby={`membro-${membro.id}-titulo`}
            className="admin-dialog admin-dialog-panel"
          >
            {aberto && (
              <div className="flex max-h-[inherit] flex-col">
                <header className="flex items-start gap-3.5 border-b border-a-line px-6 py-5">
                  {avatar}
                  <div className="min-w-0 flex-1">
                    <h2
                      id={`membro-${membro.id}-titulo`}
                      className="truncate font-display text-lg font-bold text-a-text"
                    >
                      {membro.name}
                      {membro.isSelf && (
                        <span className="ml-2 text-xs font-normal text-a-faint">(você)</span>
                      )}
                    </h2>
                    <p className="mt-0.5 truncate font-mono text-xs text-a-faint">{membro.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    className="btn-admin-icon"
                    aria-label="Fechar"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-5">
                    <Facto label="Última entrada" value={membro.ultimaEntrada} />
                    <Facto label="Membro desde" value={membro.membroDesde} />
                    {membro.convidadoPor && (
                      <Facto label="Convidado por" value={membro.convidadoPor} />
                    )}
                  </dl>

                  <Seccao titulo="Permissões" hint={ROLE_HINTS[membro.role]}>
                    {bloqueado ? (
                      <p className="text-xs text-a-faint">{membro.motivoBloqueio}</p>
                    ) : (
                      <RoleSelect userId={membro.id} role={membro.role} />
                    )}
                  </Seccao>

                  {membro.active && (
                    <Seccao
                      titulo="Palavra-passe"
                      hint="Define uma temporária para entregar em mão. Quem a receber terá de a substituir ao entrar."
                    >
                      <ResetPasswordForm userId={membro.id} userName={membro.name} />
                    </Seccao>
                  )}

                  <Seccao
                    titulo="Acesso"
                    hint={
                      membro.active
                        ? "Desativar impede a entrada. O histórico e as folhas de atividade mantêm-se."
                        : "Esta conta não consegue entrar. Reativar devolve o acesso com as permissões que tinha."
                    }
                  >
                    {bloqueado ? (
                      <p className="text-xs text-a-faint">{membro.motivoBloqueio}</p>
                    ) : membro.active ? (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={membro.id} />
                        <input type="hidden" name="active" value="false" />
                        <DangerSubmit
                          confirmMessage={`Desativar ${membro.name}? Deixa de conseguir entrar, mas o histórico é mantido.`}
                          className="btn-admin-danger"
                        >
                          Desativar conta
                        </DangerSubmit>
                      </form>
                    ) : (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={membro.id} />
                        <input type="hidden" name="active" value="true" />
                        <button type="submit" className="btn-admin-ghost">
                          Reativar conta
                        </button>
                      </form>
                    )}
                  </Seccao>
                </div>

                <footer className="flex justify-end border-t border-a-line px-6 py-4">
                  <button type="button" onClick={() => setAberto(false)} className="btn-admin-ghost">
                    Fechar
                  </button>
                </footer>
              </div>
            )}
          </dialog>,
          document.getElementById("admin-shell") ?? document.body,
        )}
    </>
  );
}
