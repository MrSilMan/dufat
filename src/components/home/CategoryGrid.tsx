import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
};

const categoryArt: Record<string, string> = {
  "iluminacao-publica": "/images/products/luminaria-st89.svg",
  "postes-e-bracos": "/images/products/poste-octogonal.svg",
  "iluminacao-decorativa": "/images/products/balizador.svg",
  "acessorios-eletricos": "/images/products/caixa.svg",
};

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="categories-title" className="bg-night-soft py-24">
      <div className="container-site">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">Catálogo</p>
          <h2 id="categories-title" className="mt-3 text-3xl font-black md:text-5xl">
            Tudo para iluminar a cidade
          </h2>
        </Reveal>

        <Reveal stagger="[data-category]" className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              data-category
              href={`/products?category=${category.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-night-line bg-night transition-all duration-300 hover:-translate-y-1.5 hover:border-dufat-sky/40 hover:glow-blue"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={categoryArt[category.slug] ?? "/images/products/luminaria-st89.svg"}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-dufat/0 transition-colors duration-300 group-hover:bg-dufat/15"
                />
              </div>
              <div className="p-5">
                <h3 className="font-bold text-white transition-colors group-hover:text-dufat-sky">
                  {category.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-white/60">{category.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-dufat-sky/70">
                  {category.productCount} produtos →
                </p>
              </div>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
