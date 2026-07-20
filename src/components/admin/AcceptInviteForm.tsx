"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/server/actions/team";
import { initialFormState } from "@/lib/validation";
import { AdminField, adminInputClass } from "@/components/admin/ui";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      <AdminField
        label="Password"
        htmlFor="invite-password"
        errors={state.errors?.password}
        hint="Mínimo 10 caracteres, com pelo menos uma letra e um número."
      >
        <input
          id="invite-password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={adminInputClass}
          placeholder="••••••••••"
        />
      </AdminField>

      <AdminField
        label="Confirmar password"
        htmlFor="invite-password-confirm"
        errors={state.errors?.confirmPassword}
      >
        <input
          id="invite-password-confirm"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={adminInputClass}
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
        {pending ? "A criar a conta…" : "Criar conta e entrar"}
      </button>
    </form>
  );
}
