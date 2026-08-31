"use client";

import { useActionState } from "react";
import { guardarColaborador } from "@/server/actions/premios";
import {
  AdminField,
  FormActions,
  FormSection,
  adminInputClass,
} from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";

type Opcao = { id: string; nome: string };

export type FichaValores = {
  id: string;
  nome: string;
  cargoId: string | null;
  departamentoId: string | null;
  dataAdmissao: string | null;
  dataSaida: string | null;
  diasSemana: number | null;
  photoUrl: string | null;
};

/**
 * The employee side of a user record.
 *
 * Separate from the permissions dropdown on the Equipa screen on purpose: what
 * someone is allowed to do in the system and what job they hold are different
 * facts that change at different times, and conflating them is how people end
 * up promoted out of a ranking by accident.
 */
export function FichaColaboradorForm({
  valores,
  cargos,
  departamentos,
}: {
  valores: FichaValores;
  cargos: Opcao[];
  departamentos: Opcao[];
}) {
  const [state, action, pending] = useActionState(guardarColaborador, initialFormState);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="id" value={valores.id} />

      <FormSection
        title="Ficha de colaborador"
        description="Determina como esta pessoa é avaliada: o cargo define contra quem é comparada, e as datas definem quantos dias de trabalho lhe são exigidos."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField
            label="Cargo"
            htmlFor="cargoId"
            errors={state.errors?.cargoId}
            hint="Volume e horas são normalizados contra a mediana do cargo."
          >
            <select
              id="cargoId"
              name="cargoId"
              defaultValue={valores.cargoId ?? ""}
              className={adminInputClass}
            >
              <option value="">Sem cargo — fora do ranking</option>
              {cargos.map((cargo) => (
                <option key={cargo.id} value={cargo.id}>
                  {cargo.nome}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField
            label="Departamento"
            htmlFor="departamentoId"
            optional
            errors={state.errors?.departamentoId}
          >
            <select
              id="departamentoId"
              name="departamentoId"
              defaultValue={valores.departamentoId ?? ""}
              className={adminInputClass}
            >
              <option value="">Sem departamento</option>
              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nome}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField
            label="Data de admissão"
            htmlFor="dataAdmissao"
            optional
            hint="Os dias esperados do mês de entrada contam só a partir desta data."
            errors={state.errors?.dataAdmissao}
          >
            <input
              id="dataAdmissao"
              name="dataAdmissao"
              type="date"
              defaultValue={valores.dataAdmissao ?? ""}
              className={adminInputClass}
            />
          </AdminField>

          <AdminField
            label="Data de saída"
            htmlFor="dataSaida"
            optional
            hint="Preencha quando alguém sai. Deixa de ser considerado nos meses seguintes."
            errors={state.errors?.dataSaida}
          >
            <input
              id="dataSaida"
              name="dataSaida"
              type="date"
              defaultValue={valores.dataSaida ?? ""}
              className={adminInputClass}
            />
          </AdminField>

          <AdminField
            label="Dias por semana"
            htmlFor="diasSemana"
            optional
            hint="Vazio = tempo inteiro (o valor do cargo). A tempo parcial, tudo é ajustado proporcionalmente."
            errors={state.errors?.diasSemana}
          >
            <input
              id="diasSemana"
              name="diasSemana"
              type="number"
              min={1}
              max={7}
              defaultValue={valores.diasSemana ?? ""}
              className={adminInputClass}
              placeholder="5"
            />
          </AdminField>

          <AdminField
            label="Fotografia"
            htmlFor="photoUrl"
            optional
            hint="Aparece no certificado de Funcionário do Mês."
            errors={state.errors?.photoUrl}
          >
            <input
              id="photoUrl"
              name="photoUrl"
              type="text"
              defaultValue={valores.photoUrl ?? ""}
              className={adminInputClass}
              placeholder="/uploads/…"
            />
          </AdminField>
        </div>

        {state.message && (
          <p
            role="status"
            className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-500"}`}
          >
            {state.message}
          </p>
        )}
      </FormSection>

      <FormActions
        error={!state.ok ? state.message : undefined}
        cancelHref="/admin/colaboradores"
        cancelLabel="Voltar"
        submitLabel="Guardar ficha"
        pending={pending}
      />
    </form>
  );
}
