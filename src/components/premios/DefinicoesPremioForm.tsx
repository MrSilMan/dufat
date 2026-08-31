"use client";

import { useActionState, useState } from "react";
import { guardarDefinicoesPremio } from "@/server/actions/premios";
import {
  AdminField,
  FormActions,
  FormSection,
  SwitchGroup,
  SwitchRow,
  adminInputClass,
} from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";
import type { AwardParametros } from "@/lib/award/types";

const PESOS = [
  { name: "pesoVolume", label: "Volume", hint: "Atividades validadas, normalizadas pelo cargo." },
  { name: "pesoHoras", label: "Horas", hint: "Horas validadas, normalizadas pelo cargo." },
  {
    name: "pesoConsistencia",
    label: "Consistência",
    hint: "Dias com registo ÷ dias de trabalho esperados.",
  },
  {
    name: "pesoQualidade",
    label: "Qualidade",
    hint: "Validadas sem nunca terem sido questionadas ÷ submetidas.",
  },
  {
    name: "pesoPontualidade",
    label: "Pontualidade",
    hint: "Registadas no próprio dia ou no seguinte ÷ submetidas.",
  },
] as const;

export function DefinicoesPremioForm({ parametros }: { parametros: AwardParametros }) {
  const [state, action, pending] = useActionState(guardarDefinicoesPremio, initialFormState);

  const [pesos, setPesos] = useState<Record<string, number>>({
    pesoVolume: parametros.pesoVolume,
    pesoHoras: parametros.pesoHoras,
    pesoConsistencia: parametros.pesoConsistencia,
    pesoQualidade: parametros.pesoQualidade,
    pesoPontualidade: parametros.pesoPontualidade,
  });

  const soma = Object.values(pesos).reduce((a, b) => a + b, 0);
  const somaOk = soma === 100;

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormSection
        title="Pesos dos componentes"
        description="Definem como a pontuação de 0 a 100 é repartida. Têm de somar exatamente 100."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {PESOS.map((peso) => (
            <AdminField
              key={peso.name}
              label={peso.label}
              htmlFor={peso.name}
              hint={peso.hint}
              errors={state.errors?.[peso.name]}
            >
              <div className="flex items-center gap-2">
                <input
                  id={peso.name}
                  name={peso.name}
                  type="number"
                  min={0}
                  max={100}
                  value={pesos[peso.name]}
                  onChange={(event) =>
                    setPesos((atual) => ({
                      ...atual,
                      [peso.name]: Number(event.target.value) || 0,
                    }))
                  }
                  className={adminInputClass}
                />
                <span className="text-sm text-a-faint">%</span>
              </div>
            </AdminField>
          ))}
        </div>

        <p
          role="status"
          className={`text-sm font-medium ${somaOk ? "text-emerald-600" : "text-rose-500"}`}
        >
          Total: {soma}% {somaOk ? "✓" : "— tem de ser exatamente 100%."}
        </p>
      </FormSection>

      <FormSection
        title="Penalizações"
        description="Pontos subtraídos ao total dos componentes."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField
            label="Por atividade rejeitada"
            htmlFor="penalRejeitada"
            errors={state.errors?.penalRejeitada}
          >
            <input
              id="penalRejeitada"
              name="penalRejeitada"
              type="number"
              min={0}
              defaultValue={parametros.penalRejeitada}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Por inconsistência questionada"
            htmlFor="penalInconsistencia"
            hint="Só conta quando o registo sinalizado é efetivamente questionado."
            errors={state.errors?.penalInconsistencia}
          >
            <input
              id="penalInconsistencia"
              name="penalInconsistencia"
              type="number"
              min={0}
              defaultValue={parametros.penalInconsistencia}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label='Excesso de "Outro"'
            htmlFor="penalOutro"
            errors={state.errors?.penalOutro}
          >
            <input
              id="penalOutro"
              name="penalOutro"
              type="number"
              min={0}
              defaultValue={parametros.penalOutro}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Folha entregue fora do prazo"
            htmlFor="penalAtraso"
            errors={state.errors?.penalAtraso}
          >
            <input
              id="penalAtraso"
              name="penalAtraso"
              type="number"
              min={0}
              defaultValue={parametros.penalAtraso}
              className={adminInputClass}
            />
          </AdminField>
        </div>
      </FormSection>

      <FormSection
        title="Limiares"
        description="As regras de elegibilidade e de normalização."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField
            label="Teto de normalização"
            htmlFor="tetoNormalizacaoPct"
            hint="% da mediana do cargo a partir da qual o componente já está no máximo. Impede que fragmentar trabalho compense."
            errors={state.errors?.tetoNormalizacaoPct}
          >
            <input
              id="tetoNormalizacaoPct"
              name="tetoNormalizacaoPct"
              type="number"
              min={100}
              max={400}
              defaultValue={parametros.tetoNormalizacaoPct}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label='Limite de horas em "Outro"'
            htmlFor="limiteOutroPct"
            hint="% das horas validadas acima da qual se aplica a penalização."
            errors={state.errors?.limiteOutroPct}
          >
            <input
              id="limiteOutroPct"
              name="limiteOutroPct"
              type="number"
              min={1}
              max={100}
              defaultValue={parametros.limiteOutroPct}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Mínimo de dias com registo"
            htmlFor="minDiasAtividade"
            hint="Ajustado proporcionalmente para quem entrou a meio do mês, esteve de licença ou trabalha a tempo parcial."
            errors={state.errors?.minDiasAtividade}
          >
            <input
              id="minDiasAtividade"
              name="minDiasAtividade"
              type="number"
              min={0}
              max={31}
              defaultValue={parametros.minDiasAtividade}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Máximo de atividades rejeitadas"
            htmlFor="maxRejeitadas"
            errors={state.errors?.maxRejeitadas}
          >
            <input
              id="maxRejeitadas"
              name="maxRejeitadas"
              type="number"
              min={0}
              defaultValue={parametros.maxRejeitadas}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Mínimo de pessoas por cargo"
            htmlFor="minPorCargo"
            hint="Abaixo deste número, o cargo é comparado com a sua mediana histórica em vez da do mês."
            errors={state.errors?.minPorCargo}
          >
            <input
              id="minPorCargo"
              name="minPorCargo"
              type="number"
              min={2}
              defaultValue={parametros.minPorCargo}
              className={adminInputClass}
            />
          </AdminField>
        </div>
      </FormSection>

      <FormSection title="Modo do prémio">
        <SwitchGroup legend="Opções do prémio">
          <SwitchRow
            name="porDepartamento"
            label="Um vencedor por departamento"
            hint="Recomendado acima de ~30 colaboradores. Sem isto, há um único vencedor para toda a empresa."
            defaultChecked={parametros.porDepartamento}
          />
          <SwitchRow
            name="excluirVencedorAnterior"
            label="Excluir o vencedor do mês anterior"
            hint="Faz o prémio rodar. Desligado por omissão."
            defaultChecked={parametros.excluirVencedorAnterior}
          />
        </SwitchGroup>
      </FormSection>

      {state.message && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-500"}`}
        >
          {state.message}
        </p>
      )}

      <FormActions
        error={!state.ok ? state.message : undefined}
        cancelHref="/admin/premios"
        cancelLabel="Voltar ao ranking"
        submitLabel="Guardar parâmetros"
        pending={pending}
      />
    </form>
  );
}
