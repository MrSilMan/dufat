import type { Metadata } from "next";
import { FilterBar } from "@/components/products/FilterBar";
import { ProductCard } from "@/components/products/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { LampShowcase } from "@/components/three/LampShowcase";
import { listCategories, listProducts, type ProductCard as ProductCardData } from "@/lib/catalog";
import { SHOWCASE_VARIANT_BY_CATEGORY } from "@/lib/three/showcaseVariants";
import { catalogQuerySchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Catálogo Dufat: luminárias públicas LED ST89, postes octogonais e cilíndricos galvanizados, braços, chumbadores e acessórios elétricos.",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = catalogQuerySchema.safeParse({
    category: typeof params.category === "string" ? params.category : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
    sort: typeof params.sort === "string" ? params.sort : undefined,
  });
  const query = parsed.success ? parsed.data : { sort: "recent" as const };

  let products: ProductCardData[] = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    [products, categories] = await Promise.all([listProducts(query), listCategories()]);
  } catch (error) {
    logger.error("products_page_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const grouped = !query.q && !query.category;
  // The header model mirrors the active category filter (ST89 head on "Todos").
  const headerVariant =
    (query.category ? SHOWCASE_VARIANT_BY_CATEGORY[query.category] : undefined) ?? "head";

  return (
    <div className="pt-16 md:pt-20">
      <header className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(143,195,255,0.35),transparent_60%)]"
        />
        <div className="container-site relative grid items-center gap-6 py-14 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h1 className="mt-3 text-4xl font-black text-ink md:text-6xl">
              Produtos <span className="text-gradient-warm">que iluminam</span>
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
              Da luminária ao chumbador: tudo o que um projeto de iluminação pública precisa, com
              stock local em Luanda.
            </p>
            <p className="mt-5 flex flex-wrap gap-2">
              <span className="chip-tech">{products.length} produtos</span>
              <span className="chip-tech">{categories.length} categorias</span>
              <span className="chip-tech">Stock em Luanda</span>
            </p>
          </div>
          {/* O modelo da categoria ativa, rodando ao lado do título */}
          <LampShowcase
            key={headerVariant}
            variant={headerVariant}
            className="hidden h-52 w-64 md:block lg:h-60 lg:w-80"
          />
        </div>
      </header>

      <FilterBar categories={categories} />

      <div className="container-site min-h-[40vh] py-12">
        {products.length === 0 && (
          <p className="py-24 text-center text-ink-faint">
            Nenhum produto encontrado{query.q ? ` para “${query.q}”` : ""}.
          </p>
        )}

        {grouped ? (
          // Grouped browsing: one section per category with distinct layouts.
          categories.map((category, categoryIndex) => {
            const categoryProducts = products.filter(
              (product) => product.category.slug === category.slug,
            );
            if (categoryProducts.length === 0) return null;
            const horizontal = categoryIndex % 2 === 0;
            return (
              <section key={category.slug} aria-labelledby={`cat-${category.slug}`} className="py-10">
                <Reveal>
                  <div className="flex items-baseline gap-4">
                    <span aria-hidden className="font-mono text-sm tracking-widest text-lumen-deep">
                      {String(categoryIndex + 1).padStart(2, "0")}
                    </span>
                    <h2 id={`cat-${category.slug}`} className="text-2xl font-extrabold text-ink md:text-3xl">
                      {category.name}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{category.description}</p>
                </Reveal>
                {horizontal ? (
                  <div className="mt-6 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        className="w-72 shrink-0 snap-start md:w-80"
                      />
                    ))}
                  </div>
                ) : (
                  <Reveal stagger="[data-card]" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryProducts.map((product) => (
                      <div key={product.id} data-card className="h-full">
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </Reveal>
                )}
              </section>
            );
          })
        ) : (
          <Reveal stagger="[data-card]" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} data-card className="h-full">
                <ProductCard product={product} />
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </div>
  );
}
