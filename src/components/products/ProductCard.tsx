import Image from "next/image";
import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { formatKz } from "@/lib/format";

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className={`group block overflow-hidden rounded-2xl border border-night-line bg-night-soft transition-all duration-300 hover:-translate-y-1 hover:border-dufat-sky/40 hover:glow-blue ${className ?? ""}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.heroImage ?? "/images/products/luminaria-st89.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-dufat px-3 py-1 text-xs font-bold text-white">
            Destaque
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-dufat-sky/80">{product.category.name}</p>
        <h3 className="mt-1 font-bold text-white transition-colors group-hover:text-dufat-sky">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-white/60">{product.shortDescription}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-white/85">
            {product.priceKz ? `desde ${formatKz(product.priceKz)}` : "Sob consulta"}
          </span>
          {product.wattage && (
            <span className="rounded-full border border-night-line px-2.5 py-0.5 text-xs text-white/60">
              {product.wattage} W
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
