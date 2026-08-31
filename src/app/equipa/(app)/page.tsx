import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatDate, formatDuracao } from "@/lib/format";
import { periodoAtual, rotuloPeriodo } from "@/lib/award/periodo";
import { carregarMinhaFolha } from "@/lib/equipa/folha";
import { acaoFolha } from "@/server/actions/atividades";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconClipboard, IconPlus } from "@/components/admin/icons";
import { EstadoFolhaBadge } from "@/components/premios/EstadoAtividadeBadge";
import { AtividadeCard } from "@/components/equipa/AtividadeCard";
import { RegistarSheet } from "@/components/equipa/RegistarSheet";
import { registoEmEdicao } from "@/components/equipa/edicao";

export const metadata: Metadata = { title: "A minha atividade", robots: { index: false } };
export const dynamic = "force-dynamic";

const BASE = "/equipa";

type Props = {
  searchParams: Promise<{ registar?: string; registo?: string }>;
};

/**
 * Início — the answer to "where do I stand, and what do I do next".
 *
 * Everything used to live on this one route: the summary, a permanently open
 * form, and the full list. Reaching yesterday's work meant scrolling past a
 * form, and nothing above the fold said what to do. The form is now a sheet and
 * the list is its own screen, which leaves this page free to say one thing.
 */
export default async function InicioPage({ searchParams }: Props) {
  const session = await requireSession("/equipa/entrar");
  const params = await searchParams;
  const periodo = periodoAtual();
  const dados = await carregarMinhaFolha(session.sub, periodo);

  const { folha, contagens, bloqueada } = dados;
  const recentes = dados.atividades.slice(0, 3);
  const porJustificar = dados.atividades.filter((a) => a.estado === "EM_JUSTIFICACAO");
  const podeSubmeter =
    folha?.estado === "ABERTA" && contagens.todas > 0 && contagens.justificacao === 0;
  const revistas = contagens.validadas;
  const progresso = contagens.todas > 0 ? Math.round((revistas / contagens.todas) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* One card, not four: month, state, deadline, progress and the next
          action, so the first screenful answers the question without scrolling. */}
      <section className="card-admin p-5" aria-labelledby="mes-titulo">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="mes-titulo" className="font-display text-xl font-black text-a-text">
            {rotuloPeriodo(periodo)}
          </h1>
          <span className="ml-auto">
            <EstadoFolhaBadge estado={folha?.estado ?? "ABERTA"} />
          </span>
        </div>

        <p className="mt-1.5 text-sm text-a-muted">
          <EstadoPrazo dados={dados} />
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-a-line py-3.5">
          {[
            { rotulo: "Registos", valor: String(contagens.todas) },
            { rotulo: "Validadas", valor: formatDuracao(dados.minutosValidados) },
            { rotulo: "Dias", valor: String(dados.diasComRegisto) },
          ].map((item) => (
            <div key={item.rotulo} className="min-w-0">
              <dt className="truncate text-[0.62rem] font-semibold uppercase tracking-wider text-a-muted">
                {item.rotulo}
              </dt>
              {/* text-sm at 360px: "53h 29min" is nine mono characters and a
                  third of that width, and a truncated duration is worse than a
                  slightly smaller one. */}
              <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-a-text sm:text-base">
                {item.valor}
              </dd>
            </div>
          ))}
        </dl>

        {contagens.todas > 0 && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-xs text-a-muted">
              <span>Revisão</span>
              <span className="font-mono tabular-nums">
                {revistas} de {contagens.todas} validadas
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Registos validados"
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-a-inset"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-dufat-bright to-dufat transition-[width]"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          {bloqueada ? (
            <p className="text-sm text-a-muted">
              A folha já foi submetida. Fale com o Gestor de RH se precisar de a reabrir.
            </p>
          ) : (
            <>
              <Link
                href={{ pathname: BASE, query: { registar: "1" } }}
                scroll={false}
                className="btn-admin min-h-11 justify-center sm:flex-none sm:px-7"
              >
                <IconPlus className="h-4 w-4" />
                Registar atividade
              </Link>

              {podeSubmeter ? (
                <form action={acaoFolha} className="contents">
                  <input type="hidden" name="folhaId" value={folha!.id} />
                  <input type="hidden" name="acao" value="submeter" />
                  <DangerSubmit
                    confirmMessage={`Submeter a folha de ${rotuloPeriodo(periodo)}? Deixa de poder adicionar ou editar atividades.`}
                    tone="primary"
                    className="btn-admin-ghost min-h-11 justify-center sm:flex-none sm:px-7"
                  >
                    Submeter folha
                  </DangerSubmit>
                </form>
              ) : (
                <button
                  type="button"
                  disabled
                  className="btn-admin-ghost min-h-11 cursor-not-allowed justify-center opacity-55 sm:flex-none sm:px-7"
                >
                  Submeter folha
                </button>
              )}
            </>
          )}
        </div>

        {!bloqueada && !podeSubmeter && (
          <p className="mt-2 text-xs text-a-muted">
            {contagens.todas === 0
              ? "Registe pelo menos uma atividade antes de submeter."
              : `Resolva ${contagens.justificacao} registo(s) devolvido(s) antes de submeter.`}
          </p>
        )}
      </section>

      {porJustificar.length > 0 && (
        <section className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4">
          <h2 className="text-sm font-semibold text-a-text">
            {porJustificar.length} registo(s) devolvido(s) para justificação
          </h2>
          <p className="mt-1 text-sm text-a-muted">
            Enquanto ficarem por justificar, não é elegível para o prémio deste mês.
          </p>
          <Link
            href={{ pathname: "/equipa/registos", query: { filtro: "justificacao" } }}
            className="btn-admin mt-3.5 inline-flex min-h-11 px-5 text-sm"
          >
            Ver e justificar
          </Link>
        </section>
      )}

      {dados.semCargo && (
        <p className="rounded-2xl border border-a-line bg-a-inset p-4 text-sm text-a-muted">
          A sua ficha ainda não tem cargo atribuído, por isso a sua atividade não entra no ranking
          do prémio. Fale com o Gestor de Recursos Humanos — pode continuar a registar normalmente
          entretanto.
        </p>
      )}

      <section aria-labelledby="recentes-titulo" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recentes-titulo" className="font-display text-base font-bold text-a-text">
            Atividade recente
          </h2>
          {contagens.todas > 3 && (
            <Link
              href="/equipa/registos"
              className="-mr-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-a-accent hover:underline"
            >
              Ver todos ({contagens.todas})
            </Link>
          )}
        </div>

        {recentes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-a-line-strong p-8 text-center">
            <span
              aria-hidden
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-a-inset text-a-faint"
            >
              <IconClipboard className="h-5 w-5" />
            </span>
            <p className="mt-3 font-semibold text-a-text">Ainda não registou nada este mês</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-a-muted">
              Registar no próprio dia conta para a pontuação de pontualidade.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentes.map((atividade) => (
              <AtividadeCard
                key={atividade.id}
                atividade={atividade}
                basePath={BASE}
                bloqueada={bloqueada}
              />
            ))}
          </div>
        )}
      </section>

      <RegistarSheet
        key={params.registo ?? (params.registar ? "novo" : "fechado")}
        aberto={Boolean(params.registar || params.registo) && !bloqueada}
        categorias={dados.categorias}
        hoje={dados.diaPorOmissao}
        minDia={dados.minDia}
        maxDia={dados.maxDia}
        emEdicao={registoEmEdicao(dados.atividades, params.registo)}
        voltarPara={BASE}
        listaPara="/equipa/registos"
      />
    </div>
  );
}

/** The deadline, said in the tense the sheet is actually in. */
function EstadoPrazo({ dados }: { dados: Awaited<ReturnType<typeof carregarMinhaFolha>> }) {
  const { folha, prazo, diasAtePrazo } = dados;

  if (folha?.estado === "FECHADA") {
    return <>Folha fechada — já entrou no cálculo do prémio.</>;
  }
  if (folha?.estado === "SUBMETIDA") {
    return (
      <>
        Submetida a {folha.submetidaEm ? formatDate(folha.submetidaEm) : "—"}. Aguarda validação.
      </>
    );
  }
  if (!prazo || diasAtePrazo === null) {
    return <>Registe o que fez e submeta a folha no fim do mês.</>;
  }
  if (diasAtePrazo < 0) {
    return (
      <span className="font-medium text-rose-500">
        Prazo ultrapassado há {Math.abs(diasAtePrazo)} dia(s) — submeter agora desconta pontos.
      </span>
    );
  }
  if (diasAtePrazo === 0) {
    return <span className="font-medium text-amber-600">Último dia para submeter.</span>;
  }
  return (
    <>
      Faltam <span className="font-semibold text-a-text">{diasAtePrazo} dia(s)</span> para submeter
      ({formatDate(prazo)}).
    </>
  );
}
