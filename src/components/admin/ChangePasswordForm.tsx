"use client";

import { useActionState } from "react";
import { changeOwnPassword } from "@/server/actions/team";
import { initialFormState } from "@/lib/validation";
import { AdminField } from "@/components/admin/ui";
import { PasswordInput } from "@/components/admin/PasswordInput";

/**
 * Replaces the temporary password an admin set.
 *
 * Deliberately offers no way out: there is no "later" link and no navigation,
 * because every other route redirects back here until this form succeeds.
 */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <AdminField
        label="Nova palavra-passe"
        htmlFor="nova-password"
        errors={state.errors?.password}
        hint="Mínimo 10 caracteres, com pelo menos uma letra e um número."
      >
        <PasswordInput
          id="nova-password"
          name="password"
          required
          autoComplete="new-password"
          placeholder="••••••••••"
        />
      </AdminField>

      <AdminField
        label="Confirmar palavra-passe"
        htmlFor="nova-password-confirm"
        errors={state.errors?.confirmPassword}
      >
        <PasswordInput
          id="nova-password-confirm"
          name="confirmPassword"
          required
          autoComplete="new-password"
          placeholder="••••••••••"
        />
      </AdminField>

      {state.message && !state.ok && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-500"
        >
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-admin w-full py-3">
        {pending ? "A guardar…" : "Guardar e continuar"}
      </button>
    </form>
  );
}
