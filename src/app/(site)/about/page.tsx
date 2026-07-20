import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { LampShowcase } from "@/components/three/LampShowcase";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "A história da Dufat, Lda.: comércio geral e prestação de serviços, especializada em iluminação pública e material elétrico em Angola.",
};

const milestones = [
  {
    year: "2014",
    title: "Fundação em Luanda",
    body: "A Dufat nasce como empresa de comércio geral e prestação de serviços, com foco em material elétrico.",
  },
  {
    year: "2017",
    title: "Especialização em iluminação pública",
    body: "Primeiro fornecimento de postes galvanizados e luminárias para um projeto municipal — a iluminação torna-se o core do negócio.",
  },
  {
    year: "2020",
    title: "Loja no Kilamba",
    body: "Abertura da loja no Kilamba Shopping (Edifício D3, Loja 102), aproximando o catálogo dos clientes e empreiteiros.",
  },
  {
    year: "2022",
    title: "Parceria com a Braytron",
    body: "A gama ST89 de luminárias públicas LED passa a integrar o catálogo com fichas técnicas completas e garantia de 2 anos.",
  },
  {
    year: "2024",
    title: "18 000 pontos de luz",
    body: "Ultrapassamos os dezoito mil pontos de luz fornecidos em nove províncias — das avenidas de Luanda à marginal de Benguela.",
  },
];

const commitments = [
  {
    title: "Eficiência energética",
    body: "Cada watt conta. Privilegiamos LED de alto rendimento (até 110 lm/W) e fator de potência >0,9 para reduzir a fatura energética dos municípios.",
  },
  {
    title: "Durabilidade",
    body: "Galvanização a quente, proteção IP66 e componentes com 20 000 horas de vida útil: menos manutenção, menos resíduos.",
  },
  {
    title: "Conhecimento local",
    body: "Stock em Luanda, equipa angolana e acompanhamento em obra — entendemos os prazos e a realidade dos estaleiros nacionais.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-16 md:pt-20">
      <header className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(143,195,255,0.35),transparent_65%)]"
        />
        <div className="container-site relative grid items-center gap-8 py-16 md:grid-cols-[1fr_auto] md:py-20">
          <div>
            <p className="eyebrow">Sobre a Dufat</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black text-ink md:text-6xl">
              Uma década a <span className="text-gradient-warm">iluminar Angola</span>
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">
              A Dufat — Comércio Geral e Prestação de Serviços, Lda. é especialista em iluminação
              pública, luminárias e material elétrico. Do poste ao lúmen, fornecemos tudo o que um
              projeto de iluminação precisa.
            </p>
          </div>
          {/* O candeeiro completo — o produto real, em 3D */}
          <LampShowcase variant="full" className="hidden h-80 w-56 md:block lg:h-96 lg:w-64" />
        </div>
      </header>

      {/* Timeline */}
      <section aria-labelledby="timeline-title" className="border-t border-line bg-white py-24">
        <div className="container-site">
          <Reveal>
            <h2 id="timeline-title" className="text-3xl font-black text-ink md:text-4xl">
              O nosso percurso
            </h2>
          </Reveal>
          <div className="relative mt-16">
            <div
              aria-hidden
              className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-dufat-bright via-dufat-sky to-transparent md:left-1/2"
            />
            <ol className="space-y-16">
              {milestones.map((milestone, index) => (
                <li
                  key={milestone.year}
                  className={`relative md:flex ${index % 2 === 0 ? "md:justify-start" : "md:justify-end"}`}
                >
                  <span
                    aria-hidden
                    className="absolute left-4 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-lumen ring-4 ring-lumen/25 md:left-1/2"
                  />
                  <Reveal className="ml-12 max-w-md md:ml-0 md:w-[44%]">
                    <Parallax speed={0.08}>
                      <p className="font-display text-5xl font-black text-dufat-mist">{milestone.year}</p>
                      <h3 className="mt-2 text-xl font-bold text-ink">{milestone.title}</h3>
                      <p className="mt-2 leading-relaxed text-ink-soft">{milestone.body}</p>
                    </Parallax>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section aria-labelledby="commitments-title" className="bg-paper-soft py-24">
        <div className="container-site">
          <Reveal>
            <p className="eyebrow">Compromissos</p>
            <h2 id="commitments-title" className="mt-3 text-3xl font-black text-ink md:text-4xl">
              Sustentabilidade que se <span className="text-gradient-blue">mede em kWh</span>
            </h2>
          </Reveal>
          <Reveal stagger="[data-commitment]" className="mt-12 grid gap-6 md:grid-cols-3">
            {commitments.map((commitment) => (
              <article key={commitment.title} data-commitment className="card-lift p-7">
                <h3 className="text-lg font-bold text-ink">{commitment.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{commitment.body}</p>
              </article>
            ))}
          </Reveal>
          <Reveal className="mt-14 text-center">
            <Link href="/contact" className="btn-primary px-8 py-3.5">
              Visite a nossa loja no Kilamba
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
