"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/server/actions/team";
import { ROLE_HINTS, type InviteFormState, type RoleValue } from "@/lib/validation";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";

type Opcao = { id: string; nome: string };

const initial: InviteFormState = { ok: false };

/** Shown when SMTP is unavailable: the invite exists, so hand over the link. */
function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the input is selectable anyway.
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-a-line bg-a-inset p-3.5">
      <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">
        Link do convite
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
          className={`${adminInputClass} font-mono text-xs`}
        />
        <button type="button" onClick={copy} className="btn-admin-ghost shrink-0">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function InviteForm({
  mailConfigured,
  cargos,
  departamentos,
  apenasColaborador = false,
}: {
  mailConfigured: boolean;
  cargos: Opcao[];
  departamentos: Opcao[];
  /** Locks the form to COLABORADOR — the Gestor de RH's version, matching what
   *  the server will actually let them create. */
  apenasColaborador?: boolean;
}) {
  const [state, action, pending] = useActionState(createInvite, initial);
  const [role, setRole] = useState<RoleValue>(apenasColaborador ? "COLABORADOR" : "EDITOR");

  // Only a COLABORADOR is scored, so only they need a ficha. Showing cargo and
  // admission date for an Editor would imply the catalogue team is being ranked
  // on activity, which they are not.
  const eColaborador = role === "COLABORADOR";
  const semCargos = cargos.length === 0;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormSection
        title={apenasColaborador ? "Registar colaborador" : "Registar um membro da equipa"}
        description={
          mailConfigured
            ? "O convite é enviado por email e expira em 7 dias. O próprio define a password."
            : "O envio de email não está configurado — receberá um link para partilhar. O convite expira em 7 dias."
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField label="Nome" htmlFor="invite-name" errors={state.errors?.name}>
            <input id="invite-name" name="name" required className={adminInputClass} placeholder="Maria Silva" />
          </AdminField>
          <AdminField label="Email" htmlFor="invite-email" errors={state.errors?.email}>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              className={adminInputClass}
              placeholder="maria@dufat.co.ao"
            />
          </AdminField>
        </div>

        {apenasColaborador ? (
          <input type="hidden" name="role" value="COLABORADOR" />
        ) : (
          <AdminField
            label="Permissões"
            htmlFor="invite-role"
            errors={state.errors?.role}
            hint={ROLE_HINTS[role]}
          >
            <select
              id="invite-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as RoleValue)}
              className={adminInputClass}
            >
              <option value="COLABORADOR">Colaborador</option>
              <option value="EDITOR">Editor</option>
              <option value="GESTOR_RH">Gestor de RH</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </AdminField>
        )}

        {eColaborador && (
          <div className="space-y-5 rounded-xl border border-a-line bg-a-inset p-4">
            <div>
              <p className="text-sm font-semibold text-a-text">Ficha de colaborador</p>
              <p className="mt-0.5 text-xs text-a-muted">
                Preenchida agora para que a ficha esteja completa desde o primeiro dia — sem
                cargo, o colaborador não entra no ranking do prémio.
              </p>
            </div>

            {semCargos ? (
              <p className="text-sm text-rose-500">
                Ainda não existem cargos criados. Crie os cargos da empresa antes de registar
                colaboradores.
              </p>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <AdminField label="Cargo" htmlFor="invite-cargo" errors={state.errors?.cargoId}>
                    <select id="invite-cargo" name="cargoId" className={adminInputClass}>
                      <option value="">Escolher…</option>
                      {cargos.map((cargo) => (
                        <option key={cargo.id} value={cargo.id}>
                          {cargo.nome}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField
                    label="Departamento"
                    htmlFor="invite-departamento"
                    optional
                    errors={state.errors?.departamentoId}
                  >
                    <select
                      id="invite-departamento"
                      name="departamentoId"
                      className={adminInputClass}
                    >
                      <option value="">Sem departamento</option>
                      {departamentos.map((departamento) => (
                        <option key={departamento.id} value={departamento.id}>
                          {departamento.nome}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField
                    label="Data de admissão"
                    htmlFor="invite-admissao"
                    optional
                    hint="Quem entra a meio do mês tem o mínimo de dias ajustado proporcionalmente."
                    errors={state.errors?.dataAdmissao}
                  >
                    <input
                      id="invite-admissao"
                      name="dataAdmissao"
                      type="date"
                      className={adminInputClass}
                    />
                  </AdminField>

                  <AdminField
                    label="Dias por semana"
                    htmlFor="invite-dias"
                    optional
                    hint="Deixe vazio para tempo inteiro (o valor do cargo). Preencha para tempo parcial."
                    errors={state.errors?.diasSemana}
                  >
                    <input
                      id="invite-dias"
                      name="diasSemana"
                      type="number"
                      min={1}
                      max={7}
                      className={adminInputClass}
                      placeholder="5"
                    />
                  </AdminField>
                </div>
              </>
            )}
          </div>
        )}

        {state.message && (
          <p
            role="status"
            className={
              state.ok
                ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600"
                : "rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-500"
            }
          >
            {state.message}
          </p>
        )}

        {state.inviteUrl && <InviteLink url={state.inviteUrl} />}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || (eColaborador && semCargos)}
            className="btn-admin px-7 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "A convidar…" : "Enviar convite"}
          </button>
        </div>
      </FormSection>
    </form>
  );
}
