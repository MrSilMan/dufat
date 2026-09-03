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

/**
 * Shows the temporary password once it has been saved, next to a copy button.
 *
 * It is never recoverable afterwards — only its hash is stored — so this is the
 * single moment the admin can take it, and reading fourteen mixed-case
 * characters off a screen into a chat window is exactly where they get mangled.
 */
function PasswordGuardada({ password }: { password: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the password is on screen to
      // be typed either way, so a failed copy needs no error of its own.
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-a-line bg-a-inset p-2 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-a-text">{password}</code>
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export function ResetPasswordForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, action, pending] = useActionState(resetUserPassword, initialFormState);
  const [aberto, setAberto] = useState(false);
  const [password, setPassword] = useState("");
  const inputId = useId();

  if (state.ok) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-emerald-600">{state.message}</p>
        <PasswordGuardada password={password} />
        <p className="text-xs text-a-faint">
          Anote-a ou copie-a agora — não volta a ser mostrada.
        </p>
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
        className="btn-admin-ghost"
      >
        Repor palavra-passe
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={userId} />
      <label htmlFor={inputId} className="block text-xs font-medium text-a-muted">
        Palavra-passe temporária para {userName}
      </label>
      <input
        id={inputId}
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className={`${adminInputClass} font-mono`}
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
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-admin px-4 py-2 text-sm">
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
