import Link from "next/link";
import { formatDuracao } from "@/lib/format";
import { toDia } from "@/lib/award/periodo";
import { motivosInconsistencia, type EntradaComparavel } from "@/lib/award/inconsistencia";
import { apagarAtividade } from "@/server/actions/atividades";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { EstadoAtividadeBadge } from "@/components/premios/EstadoAtividadeBadge";

/** Everything a card needs, with the Dates already resolved on the server. */
export type AtividadeVista = {
  id: string;
  descricao: string;
  dia: string;
  inicio: string;
  fim: string;
  minutos: number;
  estado: string;
  categoriaId: string;
  categoriaNome: string;
  notaRevisao: string | null;
  /** The rules that actually fired, not the list of rules that exist. */
  motivos: string[];
};

type LinhaPrisma = EntradaComparavel & {
  descricao: string;
  notaRevisao: string | null;
  possivelInconsistencia: boolean;
  categoria: { nome: string };
};

function hhmm(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Maps a sheet's rows to view models, resolving each flag into the specific
 * reasons that apply to that row.
 */
export function vistasAtividades(linhas: readonly LinhaPrisma[]): AtividadeVista[] {
  return linhas.map((linha) => ({
    id: linha.id,
    descricao: linha.descricao,
    dia: toDia(linha.dia),
    inicio: hhmm(linha.inicioEm),
    fim: hhmm(linha.fimEm),
    minutos: linha.minutos,
    estado: linha.estado,
    categoriaId: linha.categoriaId,
    categoriaNome: linha.categoria.nome,
    notaRevisao: linha.notaRevisao,
    motivos:
      linha.possivelInconsistencia && linha.estado !== "VALIDADA"
        ? motivosInconsistencia(linha, linhas)
        : [],
  }));
}

const EDITAVEIS = new Set(["RASCUNHO", "EM_JUSTIFICACAO"]);

/**
 * One entry, as a card.
 *
 * The badge sits on its own line above the description rather than beside it:
 * at 360px a status next to a long title either squeezes the title to two
 * characters or gets pushed off the edge, and this is the one screen where the
 * status has to stay next to the thing it describes.
 */
export function AtividadeCard({
  atividade,
  basePath,
  bloqueada,
  destacar = false,
}: {
  atividade: AtividadeVista;
  /** Where the edit link should return to once saved. */
  basePath: string;
  bloqueada: boolean;
  destacar?: boolean;
}) {
  const podeEditar = !bloqueada && EDITAVEIS.has(atividade.estado);
  const justificar = atividade.estado === "EM_JUSTIFICACAO";

  return (
    <article
      id={`registo-${atividade.id}`}
      // scroll-mt clears the sticky app header when arriving via the anchor.
      className={`scroll-mt-24 rounded-2xl border border-a-line bg-a-surface p-4 md:scroll-mt-36 ${destacar ? "equipa-destaque border-a-accent/40" : ""}`}
    >
      <div className="flex items-center gap-3">
        <EstadoAtividadeBadge estado={atividade.estado} />
        <span className="ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums text-a-muted">
          {formatDuracao(atividade.minutos)}
        </span>
      </div>

      <h3 className="mt-2.5 text-[0.95rem] font-semibold leading-snug text-a-text break-words">
        {atividade.descricao}
      </h3>

      <p className="mt-1 font-mono text-xs text-a-muted">
        {atividade.inicio}–{atividade.fim} · {atividade.categoriaNome}
      </p>

      {atividade.motivos.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-a-text">Sinalizada para revisão</p>
          <ul className="mt-1 space-y-0.5 text-xs text-a-muted">
            {atividade.motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </div>
      )}

      {atividade.notaRevisao && (
        <p className="mt-3 rounded-xl border border-a-line bg-a-inset p-3 text-xs leading-relaxed text-a-muted">
          <span className="font-semibold text-a-text">Nota do revisor:</span>{" "}
          {atividade.notaRevisao}
        </p>
      )}

      {podeEditar && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-a-line pt-3">
          <Link
            href={{ pathname: basePath, query: { registo: atividade.id } }}
            scroll={false}
            className={
              justificar
                ? "btn-admin min-h-11 px-5 text-sm"
                : "btn-admin-ghost min-h-11 px-5 text-sm"
            }
          >
            {justificar ? "Justificar" : "Editar"}
          </Link>
          {/* Delete is pushed away from "Editar" on the phone, where a mis-tap
              destroys something; adjacent from `sm:` up, where it just reads as
              a pair. */}
          {atividade.estado === "RASCUNHO" && (
            <form action={apagarAtividade} className="ml-auto sm:ml-0">
              <input type="hidden" name="id" value={atividade.id} />
              <DangerSubmit
                confirmMessage={`Apagar o registo “${atividade.descricao}”? Esta ação não pode ser desfeita.`}
                className="btn-admin-danger min-h-11 px-5 text-sm"
              >
                Apagar
              </DangerSubmit>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
