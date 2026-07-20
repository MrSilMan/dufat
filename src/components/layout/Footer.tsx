import Link from "next/link";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { getSiteSettings } from "@/lib/settings";

/** Strips spaces/punctuation so "+244 922 293 111" becomes a valid tel: target. */
function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

const socialLinks: { key: "facebookUrl" | "instagramUrl" | "linkedinUrl" | "whatsappUrl"; label: string }[] = [
  { key: "facebookUrl", label: "Facebook" },
  { key: "instagramUrl", label: "Instagram" },
  { key: "linkedinUrl", label: "LinkedIn" },
  { key: "whatsappUrl", label: "WhatsApp" },
];

export async function Footer() {
  const settings = await getSiteSettings();
  const socials = socialLinks.flatMap((link) => {
    const href = settings[link.key];
    return href ? [{ label: link.label, href }] : [];
  });

  return (
    <footer className="relative border-t border-line bg-white">
      {/* Thin "lit" line along the top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-0.5 bg-gradient-to-r from-transparent via-lumen to-transparent"
      />
      <div className="container-site grid gap-12 py-16 md:grid-cols-3">
        <div>
          <DufatLogo variant="dark" className="h-10" logoUrl={settings.logoUrl} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
            {settings.footerTagline}
          </p>
          <p className="mt-4 text-xs text-ink-faint">{settings.footerNif}</p>
          {socials.length > 0 && (
            <nav aria-label="Redes sociais" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft hover:text-dufat"
                >
                  {social.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <div>
          <h2 className="eyebrow text-sm">Contactos</h2>
          <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-ink-soft">
            <p>
              {settings.footerAddress.split("\n").map((line, index, lines) => (
                <span key={line}>
                  {line}
                  {index < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
            <p>
              {settings.footerPhones.map((phone, index, phones) => (
                <span key={phone}>
                  <a href={telHref(phone)} className="hover:text-dufat">
                    {phone}
                  </a>
                  {index < phones.length - 1 && <br />}
                </span>
              ))}
            </p>
            <p>
              <a href={`mailto:${settings.footerEmail}`} className="hover:text-dufat">
                {settings.footerEmail}
              </a>
            </p>
          </address>
        </div>

        <div>
          <h2 className="eyebrow text-sm">Newsletter</h2>
          <p className="mt-4 text-sm text-ink-soft">
            Novidades de catálogo, preçários e projetos — uma vez por mês.
          </p>
          <NewsletterForm />
          <nav aria-label="Ligações do rodapé" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/products" className="text-ink-soft hover:text-dufat">
              Produtos
            </Link>
            <Link href="/solutions" className="text-ink-soft hover:text-dufat">
              Soluções
            </Link>
            <Link href="/about" className="text-ink-soft hover:text-dufat">
              Sobre
            </Link>
            <Link href="/contact" className="text-ink-soft hover:text-dufat">
              Contacto
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-line bg-paper py-6">
        <p className="container-site text-xs text-ink-faint">
          © {new Date().getFullYear()} {settings.footerCopyright}
        </p>
      </div>
    </footer>
  );
}
