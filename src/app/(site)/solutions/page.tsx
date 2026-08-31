import type { Metadata } from "next";
import Link from "next/link";
import { listCaseStudies } from "@/lib/catalog";
import { logger } from "@/lib/logger";
import { CaseNarrative, type CaseStudyData } from "@/components/solutions/CaseNarrative";
import { Reveal } from "@/components/motion/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Soluções",
  description:
    "Como a Dufat entrega um projeto de iluminação pública em Angola: levantamento, dimensionamento luminotécnico, fornecimento completo com stock em Luanda e apoio em obra.",
};

/**
 * The four stages of a job, in the order they happen — the numbering carries
 * real sequence, not decoration.
 */
const PROCESS = [
  {
    kicker: "Levantamento",
    title: "Vamos ao local antes de orçamentar",
    body:
      "Medimos o vão, a largura da via e a altura útil disponível, e registamos o que já existe no terreno — postes, rede, caixas. Um orçamento feito sobre uma planta desatualizada custa caro na fase de montagem.",
    points: ["Medição do vão e da via", "Levantamento do existente", "Condições de acesso e de obra"],
  },
  {
    kicker: "Dimensionamento",
    title: "A potência certa, não a maior",
    body:
      "A partir do levantamento definimos potência, espaçamento entre postes e altura de montagem. Sobredimensionar aumenta o investimento e a factura de energia sem melhorar o resultado; subdimensionar deixa zonas escuras entre pontos de luz.",
    points: ["Escolha de potência e óptica", "Espaçamento e altura de montagem", "Estimativa de consumo"],
  },
  {
    kicker: "Fornecimento",
    title: "Tudo de um só fornecedor, com stock em Luanda",
    body:
      "Luminária, poste, braço e chumbadores saem do mesmo fornecedor e são compatíveis entre si — sem adaptações improvisadas em obra e sem esperar por um componente que vem de outro lado. O que está em stock na loja do Kilamba sai no próprio dia.",
    points: ["Luminárias LED e postes galvanizados", "Braços, chumbadores e acessórios", "Material elétrico de apoio"],
  },
  {
    kicker: "Apoio em obra",
    title: "Continuamos disponíveis depois da entrega",
    body:
      "Acompanhamos a montagem sempre que é pedido, esclarecemos dúvidas de instalação e mantemos peças de reposição em stock. Um ponto de luz apagado seis meses depois continua a ser um assunto nosso.",
    points: ["Esclarecimento de montagem", "Peças de reposição em stock", "Garantia dos equipamentos"],
  },
];

/** The kinds of job Dufat is equipped to supply. */
const APPLICATIONS = [
  {
    title: "Avenidas e vias públicas",
    body: "Postes galvanizados de 6 a 12 m com braço simples ou duplo e luminárias LED de 100 a 200 W.",
  },
  {
    title: "Condomínios e centralidades",
    body: "Iluminação de arruamentos internos, entradas e zonas comuns, com controlo por célula fotoelétrica.",
  },
  {
    title: "Zonas industriais e logísticas",
    body: "Projetores LED para pátios, parques de carga e áreas de manobra que precisam de uniformidade.",
  },
  {
    title: "Jardins e espaços exteriores",
    body: "Balizadores, apliques de parede e iluminação decorativa para percursos e áreas de lazer.",
  },
];

export default async function SolutionsPage() {
  // Real, published references render below the process. There are none today —
  // the page stands on the process alone until a genuine project is entered in
  // the admin, rather than on illustrative samples presented as clients.
  let studies: CaseStudyData[] = [];
  try {
    studies = (await listCaseStudies()) as CaseStudyData[];
  } catch (error) {
    logger.error("solutions_page_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <div className="pt-16 md:pt-20">
      <header className="container-site py-16 text-center">
        <p className="chip-tech border-lumen/60 bg-lumen/10 text-lumen-deep">Como trabalhamos</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-black text-ink md:text-6xl">
          Do levantamento à <span className="text-gradient-warm">entrega em obra</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-ink-soft">
          Um projeto de iluminação pública não se resolve com uma lista de material. Estas são as
          quatro fases que seguimos em cada obra.
        </p>
      </header>

      {/* Process — four ordered stages */}
      <section aria-labelledby="processo-title" className="border-t border-line bg-white py-16">
        <div className="container-site">
          <h2 id="processo-title" className="sr-only">
            O nosso processo
          </h2>
          <ol className="grid gap-6 md:grid-cols-2">
            {PROCESS.map((stage, index) => (
              <li key={stage.kicker}>
                <Reveal delay={index * 0.05} className="card-soft h-full p-7">
                  <div className="flex items-baseline gap-3">
                    <span aria-hidden className="font-mono text-sm tracking-widest text-lumen-deep">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-dufat-bright">
                      {stage.kicker}
                    </p>
                  </div>
                  <h3 className="mt-2 text-2xl font-extrabold text-ink">{stage.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink-soft">{stage.body}</p>
                  <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                    {stage.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span
                          aria-hidden
                          className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-lumen"
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Applications — what we are equipped to supply */}
      <section aria-labelledby="aplicacoes-title" className="py-16">
        <div className="container-site">
          <Reveal>
            <p className="eyebrow">Aplicações</p>
            <h2 id="aplicacoes-title" className="mt-3 text-3xl font-black text-ink md:text-4xl">
              O que fornecemos
            </h2>
          </Reveal>
          <Reveal stagger="[data-app]" className="mt-8 grid gap-6 sm:grid-cols-2">
            {APPLICATIONS.map((application) => (
              <div key={application.title} data-app className="card-soft h-full p-6">
                <h3 className="text-lg font-bold text-ink">{application.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{application.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Real references, once they exist */}
      {studies.length > 0 && (
        <section aria-labelledby="obras-title" className="border-t border-line">
          <div className="container-site pt-16">
            <Reveal>
              <p className="eyebrow">Obras</p>
              <h2 id="obras-title" className="mt-3 text-3xl font-black text-ink md:text-4xl">
                Projetos entregues
              </h2>
            </Reveal>
          </div>
          {studies.map((study, index) => (
            <CaseNarrative key={study.id} study={study} index={index} />
          ))}
        </section>
      )}

      <section className="border-t border-line bg-white py-24 text-center">
        <Reveal className="container-site">
          <h2 className="text-3xl font-black text-ink md:text-4xl">Fale connosco sobre o seu projeto</h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-soft">
            Envie-nos as medidas do local — ou apenas o que sabe até agora. Respondemos com proposta
            técnica e comercial em 48 horas úteis.
          </p>
          <Link href="/contact?tab=orcamento" className="btn-primary mt-8 px-8 py-3.5">
            Falar com a equipa técnica
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
