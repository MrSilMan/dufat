import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ContactForm } from "@/components/forms/ContactForm";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Fale com a Dufat: loja no Kilamba Shopping (Luanda), pedidos de orçamento para projetos de iluminação pública e material elétrico.",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "orcamento" ? "orcamento" : "mensagem";
  const productSlug = typeof params.product === "string" ? params.product : undefined;

  let products: { slug: string; name: string }[] = [];
  try {
    products = await prisma.product.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    });
  } catch (error) {
    logger.error("contact_products_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <div className="pt-16 md:pt-20">
      <header className="container-site py-14">
        <p className="eyebrow">Contacto</p>
        <h1 className="mt-3 text-4xl font-black text-ink md:text-6xl">
          Vamos iluminar o <span className="text-gradient-warm">seu projeto</span>
        </h1>
      </header>

      <div className="container-site grid gap-12 pb-24 lg:grid-cols-[3fr_2fr]">
        <Reveal>
          {/* Tabs (server-rendered; switching navigates with the tab param) */}
          <div role="tablist" aria-label="Tipo de contacto" className="mb-8 flex gap-2">
            <Link
              role="tab"
              aria-selected={tab === "mensagem"}
              href="/contact"
              className={cn(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors",
                tab === "mensagem"
                  ? "border-transparent bg-gradient-to-r from-dufat-bright to-dufat text-white shadow-[0_10px_22px_-10px_rgba(17,79,140,0.6)]"
                  : "border-line bg-white text-ink-soft hover:border-dufat/40 hover:text-ink",
              )}
            >
              Mensagem geral
            </Link>
            <Link
              role="tab"
              aria-selected={tab === "orcamento"}
              href="/contact?tab=orcamento"
              className={cn(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors",
                tab === "orcamento"
                  ? "border-transparent bg-gradient-to-r from-dufat-bright to-dufat text-white shadow-[0_10px_22px_-10px_rgba(17,79,140,0.6)]"
                  : "border-line bg-white text-ink-soft hover:border-dufat/40 hover:text-ink",
              )}
            >
              Orçamento B2B
            </Link>
          </div>

          {tab === "orcamento" ? (
            <QuoteForm products={products} initialProductSlug={productSlug} />
          ) : (
            <ContactForm />
          )}
        </Reveal>

        <Reveal delay={0.1} className="space-y-6">
          <div className="card-soft p-7">
            <h2 className="text-lg font-bold text-ink">Loja Kilamba</h2>
            <address className="mt-3 space-y-2 text-sm not-italic leading-relaxed text-ink-soft">
              <p>
                Av. Fidel de Castro — Kilamba
                <br />
                Shopping, Edifício D3 — Loja 102
                <br />
                Luanda, Angola
              </p>
              <p>
                <a href="tel:+244922293111" className="text-dufat hover:underline">
                  +244 922 293 111
                </a>{" "}
                ·{" "}
                <a href="tel:+244929184560" className="text-dufat hover:underline">
                  +244 929 184 560
                </a>
              </p>
              <p>
                <a href="mailto:geral@dufat.co.ao" className="text-dufat hover:underline">
                  geral@dufat.co.ao
                </a>
              </p>
              <p className="text-xs text-ink-faint">NIF 5002763494</p>
            </address>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line shadow-[0_14px_34px_-18px_rgba(17,79,140,0.18)]">
            <iframe
              title="Mapa — Dufat, Kilamba, Luanda"
              src="https://maps.google.com/maps?q=Kilamba%20Luanda%20Angola&z=14&output=embed"
              width="100%"
              height="320"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block w-full border-0 grayscale-[0.4]"
            />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
