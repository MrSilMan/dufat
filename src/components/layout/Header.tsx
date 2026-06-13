"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { cn } from "@/lib/cn";

const links = [
  { href: "/products", label: "Produtos" },
  { href: "/solutions", label: "Soluções" },
  { href: "/about", label: "Sobre" },
  { href: "/contact", label: "Contacto" },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-night-line bg-night/85 backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="container-site flex h-16 items-center justify-between md:h-20">
        <Link href="/" aria-label="Dufat — página inicial" className="shrink-0">
          <DufatLogo className="h-8 md:h-9" />
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium tracking-wide transition-colors hover:text-dufat-sky",
                pathname.startsWith(link.href) ? "text-dufat-sky" : "text-white/80",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/contact?tab=orcamento"
            className="rounded-full bg-dufat px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-dufat-bright hover:glow-blue"
          >
            Pedir orçamento
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={open ? "true" : "false"}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-white md:hidden"
        >
          <span aria-hidden className="relative block h-3.5 w-6">
            <span
              className={cn(
                "absolute left-0 top-0 h-0.5 w-6 bg-current transition-transform",
                open && "translate-y-1.5 rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-1.5 h-0.5 w-6 bg-current transition-opacity",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-3 h-0.5 w-6 bg-current transition-transform",
                open && "-translate-y-1.5 -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Navegação móvel"
          className="border-t border-night-line bg-night/95 px-6 py-4 backdrop-blur-md md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={closeMenu}
                  className="block rounded-md px-3 py-3 text-base font-medium text-white/90 hover:bg-dufat/20"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/contact?tab=orcamento"
                onClick={closeMenu}
                className="mt-2 block rounded-full bg-dufat px-5 py-3 text-center font-semibold text-white"
              >
                Pedir orçamento
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
