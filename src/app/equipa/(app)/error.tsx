"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconClipboard } from "@/components/admin/icons";

/**
 * Nothing on these screens is worth losing work over — an entry is saved by a
 * server action or it isn't — so the recovery offered is simply to try again.
 */
export default function ErroEquipa({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-a-line bg-a-surface p-8 text-center">
      <span
        aria-hidden
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-500"
      >
        <IconClipboard className="h-5 w-5" />
      </span>
      <h1 className="mt-3 font-display text-lg font-bold text-a-text">
        Não foi possível carregar esta página
      </h1>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-a-muted">
        Verifique a ligação e tente novamente. Os registos já guardados não se perdem.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <button type="button" onClick={reset} className="btn-admin min-h-11 px-6">
          Tentar novamente
        </button>
        <Link href="/equipa" className="btn-admin-ghost min-h-11 px-6">
          Voltar ao início
        </Link>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-[0.68rem] text-a-muted">Ref.: {error.digest}</p>
      )}
    </div>
  );
}
