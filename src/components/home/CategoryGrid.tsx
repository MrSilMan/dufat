import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { LampShowcase } from "@/components/three/LampShowcase";
import { SHOWCASE_VARIANT_BY_CATEGORY } from "@/lib/three/showcaseVariants";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
};

/** Fallback artwork for categories without a 3D showcase model. */
const categoryArt: Record<string, string> = {
  "iluminacao-publica": "/images/products/luminaria-st89.svg",
  "postes-e-bracos": "/images/products/poste-octogonal.svg",
  "iluminacao-decorativa": "/images/products/balizador.svg",
  "acessorios-eletricos": "/images/products/caixa.svg",
};

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="categories-title" className="bg-white py-24">
      <div className="container-site">
        <Reveal>
          <p className="eyebrow">Catálogo</p>
          <h2 id="categories-title" className="mt-3 text-3xl font-black text-ink md:text-5xl">
            Tudo para <span className="text-gradient-warm">iluminar a cidade</span>
          </h2>
        </Reveal>

        <Reveal stagger="[data-category]" className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const model = SHOWCASE_VARIANT_BY_CATEGORY[category.slug];
            return (
              <Link
                key={category.id}
                data-category
                href={`/products?category=${category.slug}`}
                className="card-lift group relative flex h-full flex-col overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-3xl bg-[radial-gradient(130%_105%_at_50%_0%,#16406e_0%,#0b2242_55%,#050d1c_100%)]">
                  {model ? (
                    // The product model, slowly rotating on a night stage.
                    // The sized wrapper avoids position-class conflicts with
                    // the showcase's own `relative` root.
                    <div className="absolute inset-0">
                      <LampShowcase variant={model} className="h-full w-full" />
                    </div>
                  ) : (
                    <Image
                      src={categoryArt[category.slug] ?? "/images/products/luminaria-st89.svg"}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,185,86,0.18),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-bold text-ink transition-colors group-hover:text-dufat">
                    {category.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{category.description}</p>
                  <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-semibold uppercase tracking-wider text-dufat-bright">
                    {category.productCount} produtos
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </p>
                </div>
              </Link>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
