import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, listProducts } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { whatsappLink, whatsappProductMessage } from "@/lib/whatsapp";
import { formatKz } from "@/lib/format";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductViewer360 } from "@/components/products/ProductViewer360";
import { EnergyChart } from "@/components/products/EnergyChart";
import { resolveProductVariant } from "@/lib/three/showcaseVariants";

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

  // The interactive viewer is opt-in per product ("Visualizador 3D" in the
  // admin); the rest show their photo.
  const viewerVariant = resolveProductVariant(product);

  // A WhatsApp chat that already names this product, so the buyer sends one tap
  // and the sales team knows what it is about.
  const settings = await getSiteSettings();
  const whatsappHref = whatsappLink(settings.whatsappUrl, whatsappProductMessage(product.name));

  return (
    <div className="pt-16 md:pt-20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(143,195,255,0.3),transparent_60%)]"
        />
        <div className="container-site relative grid items-center gap-10 py-16 lg:grid-cols-2">
          <Reveal>
            <nav aria-label="Caminho" className="text-sm text-ink-faint">
              <Link href="/products" className="hover:text-dufat">
                Produtos
              </Link>{" "}
              /{" "}
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-dufat">
                {product.category.name}
              </Link>
            </nav>
            <h1 className="mt-4 text-4xl font-black leading-tight text-ink md:text-5xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.modelCode && <span className="chip-tech">Modelo {product.modelCode}</span>}
              {product.wattage && <span className="chip-tech">{product.wattage} W</span>}
              {product.lumens && (
                <span className="chip-tech">
                  {new Intl.NumberFormat("pt-AO").format(product.lumens)} lm
                </span>
              )}
              {product.has3dViewer && (
                <span className="chip-tech border-lumen/60 bg-lumen/10 text-lumen-deep">Modelo 3D real</span>
              )}
            </div>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">{product.shortDescription}</p>
            <p className="mt-6 text-2xl font-bold text-ink">
              {product.priceKz ? (
                <>
                  <span className="mr-2 text-sm font-normal text-ink-faint">desde</span>
                  {formatKz(product.priceKz)}
                </>
              ) : (
                "Preço sob consulta"
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/contact?tab=orcamento&product=${product.slug}`}
                className="btn-primary px-7 py-3.5"
              >
                Pedir orçamento
              </Link>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#25D366] px-7 py-3.5 font-semibold text-[#128C4A] transition-colors hover:bg-[#25D366] hover:text-white"
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.43 12.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
                  </svg>
                  WhatsApp
                </a>
              )}
              <Link href={`/products/${product.slug}/ficha`} className="btn-ghost px-7 py-3.5">
                Ficha técnica (PDF)
              </Link>
            </div>
          </Reveal>

          <div>
            {viewerVariant ? (
              <ProductViewer360 label={product.name} variant={viewerVariant} />
            ) : (
              <Parallax
                speed={0.15}
                className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-white"
              >
                <Image
                  src={product.heroImage ?? "/images/products/luminaria-st89.svg"}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  // `contain` — show the whole product, whatever the source
                  // aspect ratio. Cropping cut the heads off tall pole photos.
                  className="object-contain p-4"
                />
              </Parallax>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="border-t border-line bg-white py-16">
        <div className="container-site grid gap-10 lg:grid-cols-[2fr_1fr]">
          <Reveal>
            <h2 className="text-2xl font-extrabold text-ink md:text-3xl">Sobre este produto</h2>
            <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-ink-soft">
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
              <h2 id="specs-title" className="text-2xl font-extrabold text-ink md:text-3xl">
                Especificações
              </h2>
            </Reveal>
            <Reveal stagger="[data-spec-group]" className="mt-8 grid gap-6 md:grid-cols-2">
              {[...specGroups.entries()].map(([group, specs]) => (
                <div key={group} data-spec-group className="card-soft overflow-hidden">
                  <h3 className="border-b border-line bg-dufat-mist/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-dufat">
                    {group}
                  </h3>
                  <dl className="divide-y divide-line">
                    {specs.map((spec) => (
                      <div key={spec.label} className="flex justify-between gap-6 px-6 py-3 text-sm">
                        <dt className="text-ink-soft">{spec.label}</dt>
                        <dd className="text-right font-medium text-ink">{spec.value}</dd>
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
        <section aria-labelledby="related-title" className="border-t border-line py-16">
          <div className="container-site">
            <Reveal>
              <h2 id="related-title" className="text-2xl font-extrabold text-ink md:text-3xl">
                Produtos relacionados
              </h2>
            </Reveal>
            <Reveal stagger="[data-card]" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedProduct) => (
                <div key={relatedProduct.id} data-card className="h-full">
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
