import type { Metadata } from "next";
import { FilterBar } from "@/components/products/FilterBar";
import { ProductCard } from "@/components/products/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { listCategories, listProducts, type ProductCard as ProductCardData } from "@/lib/catalog";
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

  return (
    <div className="pt-16 md:pt-20">
      <header className="container-site py-14">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">Catálogo</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">Produtos</h1>
        <p className="mt-4 max-w-2xl text-white/65">
          Da luminária ao chumbador: tudo o que um projeto de iluminação pública precisa, com stock
          local em Luanda.
        </p>
      </header>

      <FilterBar categories={categories} />

      <div className="container-site min-h-[40vh] py-12">
        {products.length === 0 && (
          <p className="py-24 text-center text-white/50">
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
                  <h2 id={`cat-${category.slug}`} className="text-2xl font-extrabold md:text-3xl">
                    {category.name}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">{category.description}</p>
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
                    {categoryProducts.map((product, index) => (
                      <div key={product.id} data-card className={index % 3 === 1 ? "lg:translate-y-8" : ""}>
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
              <div key={product.id} data-card>
                <ProductCard product={product} />
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </div>
  );
}
