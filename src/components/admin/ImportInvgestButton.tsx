"use client";

import { useActionState, useEffect, useRef } from "react";
import { importProductsFromInvgest } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { adminInputClass } from "@/components/admin/ui";

/**
 * Products-page header action: pull INVGEST catalog items into local products
 * (create/update by INVGEST item id). Supports a subset import: an optional
 * INVGEST-side text filter and a max count (clear "Máx." to import everything).
 *
 * The two inputs live behind a disclosure — loose in the header they read as a
 * catalog search box, which they are not.
 */
export function ImportInvgestButton() {
  const [state, action, pending] = useActionState(importProductsFromInvgest, initialFormState);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Close the panel once an import succeeds; keep it open to show errors.
  useEffect(() => {
    if (state.ok && detailsRef.current) detailsRef.current.open = false;
  }, [state.ok, state.message]);

  return (
    <details ref={detailsRef} className="relative">
      <summary className="btn-admin-ghost cursor-pointer list-none whitespace-nowrap [&::-webkit-details-marker]:hidden">
        Importar da INVGEST
        <span aria-hidden className="text-[0.65rem] opacity-70">
          ▾
        </span>
      </summary>

      <div className="card-admin absolute right-0 z-30 mt-2 w-80 p-4 text-left">
        <p className="text-sm font-semibold text-a-text">Importar da INVGEST</p>
        <p className="mt-1 text-xs text-a-muted">
          Traz artigos do catálogo de faturação para produtos locais, com o preço já com IVA.
          Artigos já importados são atualizados.
        </p>

        <form action={action} className="mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-a-text">Filtro (opcional)</span>
            <input
              name="search"
              placeholder="ex.: solar"
              title="Filtro de pesquisa aplicado no catálogo INVGEST (opcional)"
              className={`${adminInputClass} admin-input-sm`}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-a-text">Máximo de artigos</span>
            <input
              name="max"
              type="number"
              min={1}
              max={5000}
              defaultValue={50}
              title="Número máximo de artigos a importar — deixe vazio para importar tudo"
              className={`${adminInputClass} admin-input-sm`}
            />
            <span className="mt-1 block text-[0.7rem] text-a-faint">Deixe vazio para importar tudo.</span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="btn-admin w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "A importar…" : "Importar"}
          </button>
        </form>

        {state.message ? (
          <p role="status" className={`mt-2.5 text-xs ${state.ok ? "text-emerald-600" : "text-rose-500"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
