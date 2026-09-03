"use client";

import { useActionState, useId, useState } from "react";
import { resetUserPassword } from "@/server/actions/team";
import { initialFormState } from "@/lib/validation";
import { adminInputClass } from "@/components/admin/ui";

/**
 * Generates a readable temporary password.
 *
 * Ambiguous glyphs are left out (no O/0, l/1) because this is going to be read
 * down a phone or copied off a screen, and "was that a one or an ell?" is a
 * support call. Uses crypto rather than Math.random: short-lived is not the
 * same as guessable.
 */
function gerarPassword(): string {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digitos = "23456789";
  const simbolos = "!@#$%&*";
  const alfabeto = letras + digitos + simbolos;
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  const corpo = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
  // Guarantee the letter and digit the schema demands rather than trusting luck.
  return `${letras[bytes[0]! % letras.length]}${corpo}${digitos[bytes[1]! % digitos.length]}`;
}

export function ResetPasswordForm({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [state, action, pending] = useActionState(resetUserPassword, initialFormState);
  const [aberto, setAberto] = useState(false);
  const [password, setPassword] = useState("");
  const inputId = useId();

  if (state.ok && state.message) {
    return (
      <div className="text-right">
        <p className="text-xs text-emerald-600">{state.message}</p>
        <p className="mt-1 font-mono text-xs text-a-muted">{password}</p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setPassword(gerarPassword());
          setAberto(true);
        }}
        className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
      >
        Repor palavra-passe
      </button>
    );
  }

  return (
    <form action={action} className="w-full max-w-xs space-y-2 text-left">
      <input type="hidden" name="id" value={userId} />
      <label htmlFor={inputId} className="block text-xs font-medium text-a-muted">
        Palavra-passe temporária para {userName}
      </label>
      <input
        id={inputId}
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className={`${adminInputClass} font-mono text-sm`}
        autoComplete="off"
        spellCheck={false}
      />
      {state.errors?.password && (
        <p role="alert" className="text-xs text-rose-500">
          {state.errors.password[0]}
        </p>
      )}
      {state.message && !state.ok && (
        <p role="alert" className="text-xs text-rose-500">
          {state.message}
        </p>
      )}
      <p className="text-xs text-a-faint">
        Anote-a antes de guardar — não volta a ser mostrada. {userName} terá de a alterar
        ao entrar.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-admin px-3 py-1.5 text-xs">
          {pending ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setPassword(gerarPassword())}
          className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
        >
          Gerar outra
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-a-faint transition-colors hover:text-a-text"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
