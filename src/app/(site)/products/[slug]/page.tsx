import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, listProducts } from "@/lib/catalog";
import { formatKz } from "@/lib/format";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductViewer360 } from "@/components/products/ProductViewer360";
import { EnergyChart } from "@/components/products/EnergyChart";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: `${product.name} | Dufat, Lda.`,
      description: product.shortDescription,
      images: product.heroImage ? [{ url: product.heroImage }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) notFound();

  const specGroups = new Map<string, { label: string; value: string }[]>();
  for (const spec of product.specs) {
    const group = specGroups.get(spec.group) ?? [];
    group.push({ label: spec.label, value: spec.value });
    specGroups.set(spec.group, group);
  }

  const related = (await listProducts({ category: product.category.slug, sort: "recent" }).catch(() => []))
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 3);

  return (
    <div className="pt-16 md:pt-20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(17,79,140,0.35),transparent_60%)]"
        />
        <div className="container-site relative grid items-center gap-10 py-16 lg:grid-cols-2">
          <Reveal>
            <nav aria-label="Caminho" className="text-sm text-white/50">
              <Link href="/products" className="hover:text-dufat-sky">
                Produtos
              </Link>{" "}
              /{" "}
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-dufat-sky">
                {product.category.name}
              </Link>
            </nav>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">{product.name}</h1>
            {product.modelCode && (
              <p className="mt-2 font-mono text-sm text-dufat-sky">Modelo {product.modelCode}</p>
            )}
            <p className="mt-5 max-w-xl leading-relaxed text-white/70">{product.shortDescription}</p>
            <p className="mt-6 text-2xl font-bold">
              {product.priceKz ? `desde ${formatKz(product.priceKz)}` : "Preço sob consulta"}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={`/contact?tab=orcamento&product=${product.slug}`}
                className="rounded-full bg-dufat px-7 py-3.5 font-semibold text-white transition-all hover:bg-dufat-bright hover:glow-blue"
              >
                Pedir orçamento
              </Link>
              <Link
                href={`/products/${product.slug}/ficha`}
                className="rounded-full border border-dufat-sky/40 px-7 py-3.5 font-semibold text-dufat-sky transition-colors hover:bg-dufat-sky/10"
              >
                Ficha técnica (PDF)
              </Link>
            </div>
          </Reveal>

          <div>
            {product.has3dViewer ? (
              <ProductViewer360 label={product.name} />
            ) : (
              <Parallax speed={0.15} className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                <Image
                  src={product.heroImage ?? "/images/products/luminaria-st89.svg"}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </Parallax>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="border-t border-night-line bg-night-soft py-16">
        <div className="container-site grid gap-10 lg:grid-cols-[2fr_1fr]">
          <Reveal>
            <h2 className="text-2xl font-extrabold md:text-3xl">Sobre este produto</h2>
            <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-white/70">
              {product.description.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
          {product.wattage && product.lumens ? (
            <Reveal delay={0.1}>
              <EnergyChart wattage={product.wattage} lumens={product.lumens} />
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* Spec sheet */}
      {specGroups.size > 0 && (
        <section aria-labelledby="specs-title" className="py-16">
          <div className="container-site">
            <Reveal>
              <h2 id="specs-title" className="text-2xl font-extrabold md:text-3xl">
                Especificações
              </h2>
            </Reveal>
            <Reveal stagger="[data-spec-group]" className="mt-8 grid gap-6 md:grid-cols-2">
              {[...specGroups.entries()].map(([group, specs]) => (
                <div key={group} data-spec-group className="card-night overflow-hidden">
                  <h3 className="border-b border-night-line bg-dufat/15 px-6 py-3 text-sm font-bold uppercase tracking-wider text-dufat-sky">
                    {group}
                  </h3>
                  <dl className="divide-y divide-night-line">
                    {specs.map((spec) => (
                      <div key={spec.label} className="flex justify-between gap-6 px-6 py-3 text-sm">
                        <dt className="text-white/60">{spec.label}</dt>
                        <dd className="text-right font-medium text-white">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-night-line py-16">
          <div className="container-site">
            <Reveal>
              <h2 id="related-title" className="text-2xl font-extrabold md:text-3xl">
                Produtos relacionados
              </h2>
            </Reveal>
            <Reveal stagger="[data-card]" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedProduct) => (
                <div key={relatedProduct.id} data-card>
                  <ProductCard product={relatedProduct} />
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      )}
    </div>
  );
}
