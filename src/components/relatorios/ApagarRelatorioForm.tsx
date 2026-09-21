"use client";

import { useActionState, useState } from "react";
import { apagarRelatorio } from "@/server/actions/relatorios";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";

/**
 * Admin deletes a report — a day opened by mistake, or the same sales filed
 * twice — with the reason on record. It can be restored from the same page.
 *
 * The reason is held in state rather than left to the form: a form action
 * resets its uncontrolled fields whatever it returned, and a refused delete
 * (reason too short) must keep what was typed.
 */
export function ApagarRelatorioForm({
  relatorioId,
  registos,
}: {
  relatorioId: string;
  /** How many records go out of the totals with it. */
  registos: number;
}) {
  const [motivo, setMotivo] = useState("");
  const [state, action, pending] = useActionState(apagarRelatorio, initialFormState);

  return (
    <form action={action} noValidate className="card-admin space-y-4 p-5">
      <input type="hidden" name="id" value={relatorioId} />
      <div>
        <h2 className="font-display text-base font-bold text-a-text">Apagar relatório</h2>
        <p className="mt-1 text-sm text-a-muted">
          Para um dia aberto por engano ou registado em duplicado. Sai das listas, dos totais e das
          exportações, e o colaborador deixa de o poder alterar. Nada se perde: fica guardado
          {registos > 0 ? `, com ${registos === 1 ? "o registo" : `os ${registos} registos`},` : ""}{" "}
          e pode ser restaurado. O motivo fica no histórico e na auditoria.
        </p>
      </div>
      <AdminField label="Motivo" htmlFor="motivo-apagar" errors={state.errors?.motivo}>
        <textarea
          id="motivo-apagar"
          name="motivo"
          rows={2}
          required
          maxLength={500}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          className={adminInputClass}
          placeholder="Ex.: as mesmas vendas estão no relatório de 14/09"
        />
      </AdminField>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-admin-danger min-h-10 px-4 text-sm"
        >
          {pending ? "A apagar…" : "Apagar relatório"}
        </button>
        {state.message && !state.errors?.motivo && (
          <p role="status" className="text-sm text-rose-500">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
