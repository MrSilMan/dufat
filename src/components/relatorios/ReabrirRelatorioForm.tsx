"use client";

import { useActionState } from "react";
import { reabrirRelatorio } from "@/server/actions/relatorios";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";

/** Admin sends a finalized report back to draft, with the reason on record. */
export function ReabrirRelatorioForm({ relatorioId }: { relatorioId: string }) {
  const [state, action, pending] = useActionState(reabrirRelatorio, initialFormState);

  return (
    <form action={action} noValidate className="card-admin space-y-4 p-5">
      <input type="hidden" name="id" value={relatorioId} />
      <div>
        <h2 className="font-display text-base font-bold text-a-text">Reabrir relatório</h2>
        <p className="mt-1 text-sm text-a-muted">
          Volta a rascunho para o colaborador corrigir. O motivo fica no histórico e na auditoria;
          cópias já descarregadas ficam desatualizadas.
        </p>
      </div>
      <AdminField label="Motivo" htmlFor="motivo" errors={state.errors?.motivo}>
        <textarea
          id="motivo"
          name="motivo"
          rows={2}
          required
          maxLength={500}
          className={adminInputClass}
          placeholder="Ex.: falta registar a venda do TPA das 17h"
        />
      </AdminField>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-row-danger px-4 py-2 text-sm">
          {pending ? "A reabrir…" : "Reabrir relatório"}
        </button>
        {state.message && (
          <p
            role="status"
            className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-500"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
