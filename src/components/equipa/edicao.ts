import type { AtividadeVista } from "@/components/equipa/AtividadeCard";
import type { RegistoEmEdicao } from "@/components/equipa/RegistarSheet";

/** Only these can still be changed by their author — the server agrees. */
const EDITAVEIS = new Set(["RASCUNHO", "EM_JUSTIFICACAO"]);

/**
 * Resolves `?registo=<id>` into the sheet's prefilled values.
 *
 * Returns null for an id that is not on this sheet or no longer editable, so a
 * stale link opens a blank form rather than a form that cannot be saved.
 */
export function registoEmEdicao(
  atividades: readonly AtividadeVista[],
  id: string | undefined,
): RegistoEmEdicao | null {
  if (!id) return null;
  const atividade = atividades.find((a) => a.id === id);
  if (!atividade || !EDITAVEIS.has(atividade.estado)) return null;

  return {
    id: atividade.id,
    categoriaId: atividade.categoriaId,
    descricao: atividade.descricao,
    dia: atividade.dia,
    inicio: atividade.inicio,
    fim: atividade.fim,
    notaRevisao: atividade.notaRevisao,
    justificar: atividade.estado === "EM_JUSTIFICACAO",
  };
}
