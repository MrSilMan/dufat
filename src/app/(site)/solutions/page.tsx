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
    "Projetos de iluminação pública municipal e comercial em Angola: avenidas, marginais e centralidades iluminadas pela Dufat.",
};

export default async function SolutionsPage() {
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
        <p className="chip-tech border-lumen/60 bg-lumen/10 text-lumen-deep">Soluções</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-black text-ink md:text-6xl">
          Projetos que mudam a <span className="text-gradient-warm">noite das cidades</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-ink-soft">
          Do levantamento luminotécnico à entrega em obra — role para percorrer três projetos de
          referência.
        </p>
      </header>

      {studies.map((study, index) => (
        <CaseNarrative key={study.id} study={study} index={index} />
      ))}

      <section className="border-t border-line bg-white py-24 text-center">
        <Reveal className="container-site">
          <h2 className="text-3xl font-black text-ink md:text-4xl">O próximo projeto pode ser o seu</h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-soft">
            Enviamos proposta técnica e comercial em 48 horas úteis para projetos municipais e
            privados.
          </p>
          <Link href="/contact?tab=orcamento" className="btn-primary mt-8 px-8 py-3.5">
            Falar com a equipa técnica
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
