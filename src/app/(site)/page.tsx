import type { Metadata } from "next";
import HeroSequence from "@/components/home/HeroSequence";
import { SkylinePreload } from "@/components/home/SkylinePreload";
import { WhyDufat } from "@/components/home/WhyDufat";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { Testimonials } from "@/components/home/Testimonials";
import { listCategories } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const headline = [settings.heroHeadline, settings.heroHighlight].filter(Boolean).join(" ");
  return {
    // The hero headline names the home page; the root layout's template already
    // appends the brand, so it must not be repeated here.
    title: headline,
    description: settings.seoDescription,
  };
}

export default async function HomePage() {
  const settings = await getSiteSettings();
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
      <SkylinePreload />
      <HeroSequence
        eyebrow={settings.heroEyebrow}
        headline={settings.heroHeadline}
        highlight={settings.heroHighlight}
        subtitle={settings.heroSubtitle}
        scrollHint={settings.heroScrollHint}
        logoUrl={settings.logoUrl}
      />
      <WhyDufat />
      {/* Landing point for the hero's "Saltar para os produtos" link. Sits on
          its own so the target survives an empty category list. */}
      <div id="catalogo" className="scroll-mt-24" />
      {categories.length > 0 && <CategoryGrid categories={categories} />}
      <Testimonials />
    </>
  );
}
