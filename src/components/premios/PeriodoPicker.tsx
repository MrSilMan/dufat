"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { calcularPeriodo } from "@/server/actions/premios";
import { adminInputClass } from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";

/**
 * Month selector plus the calculate button.
 *
 * Changing the month navigates (a plain read); calculating is a server action
 * (a write). Keeping them visually adjacent but mechanically separate stops a
 * casual browse from silently recalculating a period.
 */
export function PeriodoPicker({
  periodo,
  periodosDisponiveis,
  confirmado,
}: {
  periodo: string;
  periodosDisponiveis: string[];
  /** A confirmed period is locked; recalculating it would rewrite an announced result. */
  confirmado: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(calcularPeriodo, initialFormState);

  const opcoes = periodosDisponiveis.includes(periodo)
    ? periodosDisponiveis
    : [periodo, ...periodosDisponiveis];

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="periodo" className="sr-only">
          Período
        </label>
        <select
          id="periodo"
          value={periodo}
          onChange={(event) => router.push(`/admin/premios?periodo=${event.target.value}`)}
          className={`${adminInputClass} h-9 w-auto py-0 text-sm`}
        >
          {opcoes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {confirmado ? (
          <button
            type="button"
            disabled
            title="Reabra o período antes de o recalcular."
            className="btn-admin cursor-not-allowed opacity-50"
          >
            Período confirmado
          </button>
        ) : (
          <form action={action}>
            <input type="hidden" name="periodo" value={periodo} />
            <button type="submit" disabled={pending} className="btn-admin">
              {pending ? "A calcular…" : "Calcular ranking"}
            </button>
          </form>
        )}
      </div>
      {state.message && (
        <p role="status" className="text-right text-xs text-rose-500">
          {state.message}
        </p>
      )}
    </div>
  );
}
