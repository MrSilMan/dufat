"use client";

import { useActionState, useState } from "react";
import { confirmarVencedor } from "@/server/actions/premios";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";
import { initialFormState } from "@/lib/validation";
import type { LinhaRankingView } from "@/lib/award/types";

/**
 * The human decision.
 *
 * The system's proposal is pre-selected, but picking anyone else is a normal,
 * supported thing to do — it just has to be explained. The justification field
 * appears the moment the selection diverges, so the requirement is obvious
 * before the submit rather than as an error afterwards.
 */
export function ConfirmarVencedorForm({
  awardPeriodId,
  periodo,
  elegiveis,
  propostoId,
}: {
  awardPeriodId: string;
  periodo: string;
  elegiveis: LinhaRankingView[];
  propostoId: string | null;
}) {
  const [state, action, pending] = useActionState(confirmarVencedor, initialFormState);
  const [escolhido, setEscolhido] = useState(propostoId ?? elegiveis[0]?.userId ?? "");

  const proposto = elegiveis.find((l) => l.userId === propostoId);
  const eOverride = Boolean(propostoId) && escolhido !== propostoId;

  if (elegiveis.length === 0) return null;

  return (
    <form action={action} noValidate>
      <input type="hidden" name="awardPeriodId" value={awardPeriodId} />
      <FormSection
        title="Confirmar vencedor"
        description={
          proposto
            ? `O sistema propõe ${proposto.nome} com ${proposto.pontuacaoTotal.toFixed(1)} pontos. A decisão é sua.`
            : "Escolha o vencedor deste período."
        }
      >
        <AdminField label="Vencedor" htmlFor="vencedor" errors={state.errors?.vencedorId}>
          <select
            id="vencedor"
            name="vencedorId"
            value={escolhido}
            onChange={(event) => setEscolhido(event.target.value)}
            className={adminInputClass}
          >
            {elegiveis.map((linha) => (
              <option key={linha.userId} value={linha.userId}>
                {linha.posicao}.º — {linha.nome} ({linha.pontuacaoTotal.toFixed(1)} pts)
                {linha.userId === propostoId ? " — proposto" : ""}
              </option>
            ))}
          </select>
        </AdminField>

        {eOverride && (
          <AdminField
            label="Porque está a alterar a proposta?"
            htmlFor="motivo-override"
            errors={state.errors?.motivoOverride}
            hint="Fica registado no período e no histórico de auditoria."
          >
            <textarea
              id="motivo-override"
              name="motivoOverride"
              rows={3}
              required
              className={adminInputClass}
              placeholder="Ex.: liderou a recuperação do stock de Viana fora do horário, o que não aparece nas horas registadas."
            />
          </AdminField>
        )}

        <AdminField
          label="Nota de confirmação"
          htmlFor="nota-confirmacao"
          optional
          errors={state.errors?.notaConfirmacao}
          hint="Aparece no histórico do prémio."
        >
          <textarea
            id="nota-confirmacao"
            name="notaConfirmacao"
            rows={2}
            className={adminInputClass}
          />
        </AdminField>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-a-line pt-4">
          <p
            role="status"
            className={`min-w-0 text-sm ${state.ok ? "text-emerald-600" : "text-rose-500"}`}
          >
            {state.message ?? ""}
          </p>
          <button type="submit" disabled={pending} className="btn-admin px-7">
            {pending ? "A confirmar…" : `Confirmar vencedor de ${periodo}`}
          </button>
        </div>

        <p className="text-xs text-a-faint">
          Confirmar fecha o período: as pontuações passam a estar visíveis para os colaboradores e
          o certificado fica disponível.
        </p>
      </FormSection>
    </form>
  );
}
