"use client";

import { useActionState } from "react";
import { login } from "@/server/actions/auth";
import { initialFormState } from "@/lib/validation";
import { AdminField, adminInputClass } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <AdminField label="Email" htmlFor="login-email">
        <input
          id="login-email"
          name="email"
          type="email"
          required
          className={adminInputClass}
          autoComplete="username"
          placeholder="nome@dufat.co.ao"
        />
      </AdminField>
      <AdminField label="Password" htmlFor="login-password">
        <input
          id="login-password"
          name="password"
          type="password"
          required
          className={adminInputClass}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </AdminField>
      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-500"
        >
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-admin w-full py-3">
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
