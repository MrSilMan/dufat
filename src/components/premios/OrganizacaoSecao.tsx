"use client";

import { useActionState, useState } from "react";
import { alternarAtivo } from "@/server/actions/organizacao";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState, type FormState } from "@/lib/validation";
import { cn } from "@/lib/cn";

export type Entrada = {
  id: string;
  nome: string;
  ativo: boolean;
  /** Cargos only: contracted days per week. */
  diasSemana?: number;
  /** Categories only: the catch-all "Outro" bucket. */
  isOutro?: boolean;
  /** How many people hold this cargo — a cargo in use cannot be retired. */
  emUso?: number;
};

type Accao = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * One reference list — cargos, departamentos or activity categories.
 *
 * Rows are retired rather than deleted: a cargo that has been used is part of
 * how past periods were scored, and removing it would break the record of who
 * was compared against whom.
 */
export function OrganizacaoSecao({
  titulo,
  descricao,
  tipo,
  entradas,
  accao,
  rotuloNome,
  genero,
  placeholder,
  comDiasSemana = false,
  comOutro = false,
}: {
  titulo: string;
  descricao: string;
  tipo: "cargo" | "departamento" | "categoria";
  entradas: Entrada[];
  accao: Accao;
  rotuloNome: string;
  /** Portuguese needs the article to agree: "Novo cargo" but "Nova categoria". */
  genero: "m" | "f";
  placeholder: string;
  comDiasSemana?: boolean;
  comOutro?: boolean;
}) {
  const [state, action, pending] = useActionState(accao, initialFormState);
  const [aEditar, setAEditar] = useState<string | null>(null);

  const emEdicao = entradas.find((e) => e.id === aEditar) ?? null;
  const novo = genero === "f" ? "Nova" : "Novo";

  return (
    <section className="card-admin p-6">
      <div className="mb-5 border-b border-a-line pb-4">
        <h2 className="font-display text-base font-bold text-a-text">{titulo}</h2>
        <p className="mt-1 text-sm text-a-muted">{descricao}</p>
      </div>

      {entradas.length > 0 && (
        <ul className="mb-5 divide-y divide-a-line">
          {entradas.map((entrada) => (
            <li
              key={entrada.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    entrada.ativo ? "text-a-text" : "text-a-faint line-through",
                  )}
                >
                  {entrada.nome}
                </p>
                <p className="mt-0.5 text-xs text-a-faint">
                  {comDiasSemana && `${entrada.diasSemana} dias/semana`}
                  {comDiasSemana && entrada.emUso !== undefined && " · "}
                  {entrada.emUso !== undefined &&
                    `${entrada.emUso} ${entrada.emUso === 1 ? "pessoa" : "pessoas"}`}
                  {comOutro && entrada.isOutro && 'Conta como "Outro" na penalização'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAEditar(entrada.id === aEditar ? null : entrada.id)}
                  className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                >
                  {entrada.id === aEditar ? "Fechar" : "Editar"}
                </button>
                <form action={alternarAtivo}>
                  <input type="hidden" name="id" value={entrada.id} />
                  <input type="hidden" name="tipo" value={tipo} />
                  <input type="hidden" name="ativo" value={entrada.ativo ? "false" : "true"} />
                  <button
                    type="submit"
                    disabled={entrada.ativo && (entrada.emUso ?? 0) > 0}
                    title={
                      entrada.ativo && (entrada.emUso ?? 0) > 0
                        ? "Mude primeiro o cargo das pessoas que o têm."
                        : undefined
                    }
                    className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {entrada.ativo ? "Desativar" : "Reativar"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4" noValidate key={aEditar ?? "novo"}>
        {emEdicao && <input type="hidden" name="id" value={emEdicao.id} />}

        <div
          className={cn(
            "grid gap-4 md:items-end",
            comDiasSemana
              ? "md:grid-cols-[minmax(0,1fr)_7rem_auto]"
              : "md:grid-cols-[minmax(0,1fr)_auto]",
          )}
        >
          <AdminField
            label={emEdicao ? `Editar ${rotuloNome}` : `${novo} ${rotuloNome}`}
            htmlFor={`${tipo}-nome`}
            errors={state.errors?.nome}
          >
            <input
              id={`${tipo}-nome`}
              name="nome"
              required
              defaultValue={emEdicao?.nome ?? ""}
              className={adminInputClass}
              placeholder={placeholder}
            />
          </AdminField>

          {comDiasSemana && (
            <AdminField
              label="Dias/semana"
              htmlFor={`${tipo}-dias`}
              errors={state.errors?.diasSemana}
            >
              <input
                id={`${tipo}-dias`}
                name="diasSemana"
                type="number"
                min={1}
                max={7}
                defaultValue={emEdicao?.diasSemana ?? 5}
                className={adminInputClass}
              />
            </AdminField>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-admin h-10 shrink-0 px-6"
          >
            {pending ? "A guardar…" : emEdicao ? "Guardar" : "Adicionar"}
          </button>
        </div>

        {comOutro && (
          <label className="flex items-center gap-2.5 text-sm text-a-muted">
            <input
              type="checkbox"
              name="isOutro"
              defaultChecked={emEdicao?.isOutro ?? false}
              className="h-4 w-4 rounded border-a-line-strong"
            />
            Conta como &quot;Outro&quot; — horas nesta categoria acima do limite descontam pontos
          </label>
        )}

        {state.message && (
          <p
            role="status"
            className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-500"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
