import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatDuracao } from "@/lib/format";
import { periodoAtual, rotuloPeriodo } from "@/lib/award/periodo";
import { carregarMinhaFolha, filtrar, type FiltroRegistos } from "@/lib/equipa/folha";
import { IconClipboard, IconPlus } from "@/components/admin/icons";
import { AtividadeCard, type AtividadeVista } from "@/components/equipa/AtividadeCard";
import { RegistarSheet } from "@/components/equipa/RegistarSheet";
import { RegistosFiltro } from "@/components/equipa/RegistosFiltro";
import { registoEmEdicao } from "@/components/equipa/edicao";

export const metadata: Metadata = { title: "Registos", robots: { index: false } };
export const dynamic = "force-dynamic";

const BASE = "/equipa/registos";

const FILTROS = new Set<FiltroRegistos>(["todas", "validadas", "justificacao", "pendentes"]);

const VAZIO: Record<FiltroRegistos, string> = {
  todas: "Ainda não registou nada este mês.",
  validadas: "Nenhum registo validado — ainda.",
  justificacao: "Nada devolvido para justificação. Boa notícia.",
  pendentes: "Nenhum registo à espera de revisão.",
};

/** `YYYY-MM-DD` → "Sábado, 30 de agosto". */
const FORMATADOR_DIA = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function rotuloDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  const rotulo = FORMATADOR_DIA.format(new Date(`${dia}T00:00:00Z`));
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

function agruparPorDia(atividades: AtividadeVista[]) {
  const grupos = new Map<string, AtividadeVista[]>();
  for (const atividade of atividades) {
    const lista = grupos.get(atividade.dia) ?? [];
    lista.push(atividade);
    grupos.set(atividade.dia, lista);
  }
  return [...grupos.entries()];
}

type Props = {
  searchParams: Promise<{
    filtro?: string;
    registar?: string;
    registo?: string;
    novo?: string;
  }>;
};

/**
 * Registos — the month's entries and nothing else.
 *
 * Grouped by day rather than listed flat: the sheet is a record of days worked,
 * and "what did I do on the 12th" is the question this screen actually gets.
 */
export default async function RegistosPage({ searchParams }: Props) {
  const session = await requireSession("/equipa/entrar");
  const params = await searchParams;
  const periodo = periodoAtual();
  const dados = await carregarMinhaFolha(session.sub, periodo);

  const filtro: FiltroRegistos = FILTROS.has(params.filtro as FiltroRegistos)
    ? (params.filtro as FiltroRegistos)
    : "todas";
  const visiveis = filtrar(dados.atividades, filtro);
  const grupos = agruparPorDia(visiveis);
  const hoje = dados.diaPorOmissao;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-a-text">Registos</h1>
          <p className="mt-0.5 text-sm text-a-muted">{rotuloPeriodo(periodo)}</p>
        </div>
        {!dados.bloqueada && (
          <Link
            href={{ pathname: BASE, query: { registar: "1" } }}
            scroll={false}
            className="btn-admin hidden min-h-11 md:inline-flex"
          >
            <IconPlus className="h-4 w-4" />
            Registar atividade
          </Link>
        )}
      </div>

      <RegistosFiltro ativo={filtro} contagens={dados.contagens} />

      {visiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-a-line-strong p-10 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-a-inset text-a-faint"
          >
            <IconClipboard className="h-5 w-5" />
          </span>
          <p className="mt-3 font-semibold text-a-text">{VAZIO[filtro]}</p>
          {filtro !== "todas" && (
            <Link
              href={BASE}
              className="mt-3 inline-block text-sm font-medium text-a-accent hover:underline"
            >
              Ver todos os registos
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([dia, doDia]) => {
            const minutos = doDia.reduce((soma, a) => soma + a.minutos, 0);
            return (
              <section key={dia} aria-labelledby={`dia-${dia}`}>
                {/* Sticky under the app header: 4rem on the phone, taller on
                    desktop where the header also carries the tabs. */}
                <div className="equipa-dia sticky top-16 z-10 -mx-5 mb-3 px-5 py-2 md:-mx-2 md:top-28 md:px-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 id={`dia-${dia}`} className="text-sm font-bold text-a-text">
                      {rotuloDia(dia, hoje)}
                    </h2>
                    <p className="shrink-0 font-mono text-xs tabular-nums text-a-muted">
                      {doDia.length} · {formatDuracao(minutos)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {doDia.map((atividade) => (
                    <AtividadeCard
                      key={atividade.id}
                      atividade={atividade}
                      basePath={BASE}
                      bloqueada={dados.bloqueada}
                      destacar={atividade.id === params.novo}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <RegistarSheet
        key={params.registo ?? (params.registar ? "novo" : "fechado")}
        aberto={Boolean(params.registar || params.registo) && !dados.bloqueada}
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
