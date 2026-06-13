import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { PrintButton } from "@/components/products/PrintButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  return { title: product ? `Ficha Técnica — ${product.name}` : "Ficha técnica" };
}

/** Print-optimized spec sheet (use the button to print or save as PDF). */
export default async function FichaTecnicaPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) notFound();

  const specGroups = new Map<string, { label: string; value: string }[]>();
  for (const spec of product.specs) {
    const group = specGroups.get(spec.group) ?? [];
    group.push({ label: spec.label, value: spec.value });
    specGroups.set(spec.group, group);
  }

  return (
    <div className="min-h-screen bg-white pt-16 text-slate-900 md:pt-20 print:pt-0">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="flex items-start justify-between border-b-4 border-dufat pb-6">
          <div>
            <DufatLogo variant="dark" className="h-10" />
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-dufat">
              Ficha Técnica
            </p>
          </div>
          <div className="text-right text-xs leading-relaxed text-slate-500">
            <p>Av. Fidel de Castro — Kilamba</p>
            <p>Shopping, Edifício D3 — Loja 102</p>
            <p>+244 922 293 111 · geral@dufat.co.ao</p>
          </div>
        </header>

        <div className="mt-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">{product.name}</h1>
            {product.modelCode && (
              <p className="mt-1 font-mono text-sm text-dufat">Modelo {product.modelCode}</p>
            )}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
              {product.shortDescription}
            </p>
          </div>
          {product.heroImage && (
            <div className="relative h-32 w-44 shrink-0 overflow-hidden rounded-lg border border-slate-200">
              <Image src={product.heroImage} alt={product.name} fill className="object-cover" />
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[...specGroups.entries()].map(([group, specs]) => (
            <table key={group} className="w-full border-collapse text-sm">
              <caption className="border-b-2 border-dufat pb-1 text-left font-bold uppercase tracking-wide text-dufat">
                {group}
              </caption>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.label} className="border-b border-slate-100">
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-slate-500">
                      {spec.label}
                    </th>
                    <td className="py-2 text-right font-semibold">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 print:hidden">
          <Link href={`/products/${product.slug}`} className="text-sm text-dufat hover:underline">
            ← Voltar ao produto
          </Link>
          <PrintButton />
        </footer>
      </div>
    </div>
  );
}
