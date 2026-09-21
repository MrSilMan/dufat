"use client";

import { useActionState } from "react";
import { restaurarRelatorio } from "@/server/actions/relatorios";
import { initialFormState } from "@/lib/validation";

/** Admin brings a deleted report back, on its day and in the state it was in. */
export function RestaurarRelatorioForm({ relatorioId }: { relatorioId: string }) {
  const [state, action, pending] = useActionState(restaurarRelatorio, initialFormState);

  return (
    <form action={action} className="card-admin space-y-4 p-5">
      <input type="hidden" name="id" value={relatorioId} />
      <div>
        <h2 className="font-display text-base font-bold text-a-text">Restaurar relatório</h2>
        <p className="mt-1 text-sm text-a-muted">
          Volta às listas e aos totais, no mesmo dia e no mesmo estado em que foi apagado. Fica
          registado no histórico e na auditoria.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-admin min-h-10 px-4 text-sm">
          {pending ? "A restaurar…" : "Restaurar relatório"}
        </button>
        {state.message && (
          <p role="status" className="text-sm text-rose-500">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
