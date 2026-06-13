import type { Metadata } from "next";
import HeroSequence from "@/components/home/HeroSequence";
import { WhyDufat } from "@/components/home/WhyDufat";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { Testimonials } from "@/components/home/Testimonials";
import { listCategories } from "@/lib/catalog";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dufat, Lda. — Iluminamos o futuro de Angola",
  description:
    "Explore o nosso candeeiro de rua peça a peça: luminárias LED ST89, postes galvanizados, braços e acessórios elétricos para projetos municipais e privados.",
};

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    categories = await listCategories();
  } catch (error) {
    logger.error("home_categories_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <>
      <HeroSequence />
      <WhyDufat />
      {categories.length > 0 && <CategoryGrid categories={categories} />}
      <Testimonials />
    </>
  );
}
