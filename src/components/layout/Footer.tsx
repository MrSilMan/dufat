import Link from "next/link";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

export function Footer() {
  return (
    <footer className="border-t border-night-line bg-night-soft">
      <div className="container-site grid gap-12 py-16 md:grid-cols-3">
        <div>
          <DufatLogo className="h-10" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Comércio geral e prestação de serviços. Iluminamos o futuro das cidades de Angola com
            soluções LED eficientes e duradouras.
          </p>
          <p className="mt-4 text-xs text-white/40">NIF 5002763494</p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-dufat-sky">Contactos</h2>
          <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-white/70">
            <p>
              Av. Fidel de Castro — Kilamba
              <br />
              Shopping, Edifício D3 — Loja 102
              <br />
              Luanda, Angola
            </p>
            <p>
              <a href="tel:+244922293111" className="hover:text-dufat-sky">
                +244 922 293 111
              </a>
              <br />
              <a href="tel:+244929184560" className="hover:text-dufat-sky">
                +244 929 184 560
              </a>
            </p>
            <p>
              <a href="mailto:geral@dufat.co.ao" className="hover:text-dufat-sky">
                geral@dufat.co.ao
              </a>
            </p>
          </address>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-dufat-sky">Newsletter</h2>
          <p className="mt-4 text-sm text-white/60">
            Novidades de catálogo, preçários e projetos — uma vez por mês.
          </p>
          <NewsletterForm />
          <nav aria-label="Ligações do rodapé" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/products" className="text-white/70 hover:text-dufat-sky">
              Produtos
            </Link>
            <Link href="/solutions" className="text-white/70 hover:text-dufat-sky">
              Soluções
            </Link>
            <Link href="/about" className="text-white/70 hover:text-dufat-sky">
              Sobre
            </Link>
            <Link href="/contact" className="text-white/70 hover:text-dufat-sky">
              Contacto
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-night-line py-6">
        <p className="container-site text-xs text-white/40">
          © {new Date().getFullYear()} Dufat — Comércio Geral e Prestação de Serviços, Lda. Todos os
          direitos reservados.
        </p>
      </div>
    </footer>
  );
}
