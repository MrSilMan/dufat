"use client";

import { useActionState, useState } from "react";
import { alterarDiaRelatorio } from "@/server/actions/relatorios";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState, type FormState } from "@/lib/validation";

/**
 * Admin moves a report to another day, with the reason on record — for a
 * colaborador who filed the day's sales under the wrong date.
 *
 * The fields are held in state rather than left to the form: a refused move
 * (that day already has a report) must keep what was typed, and a form action
 * resets its uncontrolled fields whatever it returned. `hoje` comes from the
 * server, in Luanda time, as the upper bound.
 */
export function MudarDiaRelatorioForm({
  relatorioId,
  dia: diaAtual,
  hoje,
}: {
  relatorioId: string;
  dia: string;
  hoje: string;
}) {
  const [dia, setDia] = useState(diaAtual);
  const [motivo, setMotivo] = useState("");
  const [state, action, pending] = useActionState(
    async (anterior: FormState, dados: FormData) => {
      const resultado = await alterarDiaRelatorio(anterior, dados);
      if (resultado.ok) setMotivo("");
      return resultado;
    },
    initialFormState,
  );

  return (
    <form action={action} noValidate className="card-admin space-y-4 p-5">
      <input type="hidden" name="id" value={relatorioId} />
      <div>
        <h2 className="font-display text-base font-bold text-a-text">Mudar a data</h2>
        <p className="mt-1 text-sm text-a-muted">
          Passa o relatório, com todos os registos, para outro dia. Rascunho ou finalizado, fica
          como está. O motivo fica no histórico e na auditoria.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <AdminField label="Novo dia" htmlFor="novo-dia" errors={state.errors?.dia}>
          <input
            id="novo-dia"
            name="dia"
            type="date"
            required
            value={dia}
            max={hoje}
            onChange={(evento) => setDia(evento.target.value)}
            className={adminInputClass}
          />
        </AdminField>
        <AdminField label="Motivo" htmlFor="motivo-dia" errors={state.errors?.motivo}>
          <textarea
            id="motivo-dia"
            name="motivo"
            rows={2}
            required
            maxLength={500}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            className={adminInputClass}
            placeholder="Ex.: as vendas eram de domingo, registadas na segunda"
          />
        </AdminField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || dia === diaAtual}
          className="btn-admin-ghost min-h-10 px-4 text-sm"
        >
          {pending ? "A mudar…" : "Mudar a data"}
        </button>
        {state.message && !(state.errors?.dia || state.errors?.motivo) && (
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
