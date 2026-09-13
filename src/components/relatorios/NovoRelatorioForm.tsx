"use client";

import { useActionState } from "react";
import { abrirRelatorio } from "@/server/actions/relatorios";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";

/**
 * Picks the day to report on. Opening a day that already has a report goes
 * to that report rather than creating a second one.
 *
 * `hoje` comes from the server in Luanda time; the browser's own clock is not
 * trusted for the upper bound, and the server checks it again anyway.
 */
export function NovoRelatorioForm({ hoje }: { hoje: string }) {
  const [state, action, pending] = useActionState(abrirRelatorio, initialFormState);

  return (
    <form action={action} noValidate className="card-admin p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end">
        <AdminField
          label="Dia do relatório"
          htmlFor="dia"
          errors={state.errors?.dia}
          hint="Pode registar dias anteriores, mas não datas futuras."
        >
          <input
            id="dia"
            name="dia"
            type="date"
            required
            defaultValue={hoje}
            max={hoje}
            className={adminInputClass}
          />
        </AdminField>
        <button type="submit" disabled={pending} className="btn-admin min-h-11 px-6 sm:mb-6">
          {pending ? "A abrir…" : "Abrir relatório"}
        </button>
      </div>
      {state.message && !state.errors?.dia && (
        <p role="alert" className="mt-3 text-sm text-rose-500">
          {state.message}
        </p>
      )}
    </form>
  );
}
