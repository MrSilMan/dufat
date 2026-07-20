import Image from "next/image";
import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { formatKz } from "@/lib/format";
import { LampShowcase } from "@/components/three/LampShowcase";
import { SHOWCASE_VARIANT_BY_CATEGORY } from "@/lib/three/showcaseVariants";

/** Deterministic per-product rotation offset so equal models don't spin in lockstep. */
function slugPhase(slug: string): number {
  let sum = 0;
  for (const ch of slug) sum += ch.charCodeAt(0);
  return sum % 7;
}

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const variant = SHOWCASE_VARIANT_BY_CATEGORY[product.category.slug];
  return (
    <Link
      href={`/products/${product.slug}`}
      className={`card-lift group flex h-full flex-col overflow-hidden ${className ?? ""}`}
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-3xl bg-[radial-gradient(130%_105%_at_50%_0%,#16406e_0%,#0b2242_55%,#050d1c_100%)]">
        {variant ? (
          // The category's model on a night turntable stage. The sized wrapper
          // avoids position-class conflicts with the showcase's `relative` root.
          <div className="absolute inset-0">
            <LampShowcase
              variant={variant}
              phase={slugPhase(product.slug)}
              className="h-full w-full"
            />
          </div>
        ) : (
          <Image
            src={product.heroImage ?? "/images/products/luminaria-st89.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
        )}
        {/* A warm glow washes over the product on hover */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,185,86,0.2),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {product.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-lumen px-3 py-1 text-xs font-bold text-ink shadow-[0_6px_18px_-4px_rgba(255,185,86,0.7)]">
            Destaque
          </span>
        )}
        {product.has3dViewer && (
          <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-white/90 px-3 py-1 font-mono text-[10px] tracking-wider text-dufat backdrop-blur-sm">
            3D
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-dufat-bright">
            {product.category.name}
          </p>
          {product.modelCode && (
            <span className="shrink-0 font-mono text-[11px] tracking-wider text-ink-faint">
              {product.modelCode}
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-lg font-bold text-ink transition-colors group-hover:text-dufat">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {product.shortDescription}
        </p>

        {(product.wattage || product.lumens) && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {product.wattage && <span className="chip-tech">{product.wattage} W</span>}
            {product.lumens && (
              <span className="chip-tech">
                {new Intl.NumberFormat("pt-AO").format(product.lumens)} lm
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="font-semibold text-ink">
            {product.priceKz ? (
              <>
                <span className="mr-1 text-xs font-normal text-ink-faint">desde</span>
                {formatKz(product.priceKz)}
              </>
            ) : (
              "Sob consulta"
            )}
          </span>
          <span
            aria-hidden
            className="text-dufat-bright transition-transform duration-300 group-hover:translate-x-1.5"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
