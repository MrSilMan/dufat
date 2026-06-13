"use client";

import { useActionState } from "react";
import { login } from "@/server/actions/auth";
import { initialFormState } from "@/lib/validation";
import { Field, inputClass } from "@/components/forms/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="login-email">
        <input
          id="login-email"
          name="email"
          type="email"
          required
          className={inputClass}
          autoComplete="username"
        />
      </Field>
      <Field label="Password" htmlFor="login-password">
        <input
          id="login-password"
          name="password"
          type="password"
          required
          className={inputClass}
          autoComplete="current-password"
        />
      </Field>
      {state.message && (
        <p role="alert" className="text-sm text-amber-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-dufat py-3 font-semibold text-white transition-colors hover:bg-dufat-bright disabled:opacity-60"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
