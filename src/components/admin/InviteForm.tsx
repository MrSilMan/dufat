"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/server/actions/team";
import type { InviteFormState } from "@/lib/validation";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";

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

export function InviteForm({ mailConfigured }: { mailConfigured: boolean }) {
  const [state, action, pending] = useActionState(createInvite, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormSection
        title="Convidar um membro"
        description={
          mailConfigured
            ? "O convite é enviado por email e expira em 7 dias."
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

        <AdminField
          label="Permissões"
          htmlFor="invite-role"
          errors={state.errors?.role}
          hint="Editores gerem produtos, orçamentos e conteúdo. Administradores gerem também a equipa, a marca e podem apagar registos."
        >
          <select id="invite-role" name="role" defaultValue="EDITOR" className={adminInputClass}>
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </AdminField>

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
          <button type="submit" disabled={pending} className="btn-admin px-7 py-2.5">
            {pending ? "A convidar…" : "Enviar convite"}
          </button>
        </div>
      </FormSection>
    </form>
  );
}
