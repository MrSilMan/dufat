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

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [overHero, setOverHero] = useState(false);
  const [open, setOpen] = useState(false);

  // Track scroll and whether the header band still floats over the dark
  // 3D hero ([data-hero-dark]) — while it does, the bar must not paint a
  // white pill on top of the night scene.
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>("[data-hero-dark]");
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      if (hero) {
        const rect = hero.getBoundingClientRect();
        setOverHero(rect.top < 90 && rect.bottom > 90);
      } else {
        setOverHero(false);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  const closeMenu = () => setOpen(false);
  // Over the night scene: fully transparent at the top, dark glass once
  // scrolling starts. Over light content: the white floating pill.
  const dark = overHero && !open;
  const transparent = dark && !scrolled;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6">
      <div
        className={cn(
          "mx-auto max-w-6xl rounded-2xl border transition-all duration-300",
          transparent
            ? "border-transparent bg-transparent shadow-none"
            : dark
              ? "border-white/10 bg-night-soft/70 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md"
              : "border-line bg-white/90 shadow-[0_14px_36px_-18px_rgba(17,79,140,0.35)] backdrop-blur-md",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 md:h-16 md:px-6">
          <Link href="/" aria-label="Dufat — página inicial" className="shrink-0">
            <DufatLogo variant={dark ? "light" : "dark"} className="h-7 md:h-8" logoUrl={logoUrl} />
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-7 md:flex">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative py-1 text-sm font-semibold tracking-wide transition-colors",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gradient-to-r after:from-lumen after:to-dufat-bright after:transition-transform after:duration-300 hover:after:scale-x-100",
                    dark
                      ? active
                        ? "text-white after:scale-x-100"
                        : "text-white/80 hover:text-white"
                      : active
                        ? "text-dufat after:scale-x-100"
                        : "text-ink-soft hover:text-dufat",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/contact?tab=orcamento" className="btn-primary px-5 py-2.5 text-sm">
              Pedir orçamento
            </Link>
          </nav>

          <button
            type="button"
            aria-expanded={open ? "true" : "false"}
            aria-controls="mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md md:hidden",
              dark ? "text-white" : "text-ink",
            )}
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
            className="border-t border-line px-4 py-4 md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="block rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-dufat-mist/50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/contact?tab=orcamento"
                  onClick={closeMenu}
                  className="btn-primary mt-2 w-full px-5 py-3 text-center"
                >
                  Pedir orçamento
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
