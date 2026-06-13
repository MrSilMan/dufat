"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/cn";

const testimonials = [
  {
    quote:
      "Substituímos 400 luminárias de vapor de sódio pelas ST89 de 150W. A poupança na fatura energética pagou o investimento em menos de dois anos.",
    author: "Diretor de Obras",
    organization: "Administração Municipal",
  },
  {
    quote:
      "A Dufat entregou postes, braços e chumbadores faseados de acordo com o nosso cronograma de betonagem. Zero atrasos no estaleiro.",
    author: "Engenheiro Residente",
    organization: "Construtora — Luanda",
  },
  {
    quote:
      "O apoio na especificação fez a diferença: fichas técnicas completas e amostras no dia seguinte ao pedido.",
    author: "Gabinete de Projetos",
    organization: "Consultora de Engenharia",
  },
];

const clients = [
  "Administrações Municipais",
  "Construtoras",
  "Gabinetes de Engenharia",
  "Condomínios",
  "Indústria",
  "Comércio",
];

export function Testimonials() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setActive((index) => (index + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section aria-labelledby="testimonials-title" className="border-t border-night-line bg-night py-24">
      <div className="container-site">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">Clientes</p>
          <h2 id="testimonials-title" className="mt-3 text-3xl font-black md:text-5xl">
            Quem já ilumina connosco
          </h2>
        </Reveal>

        <Reveal className="mt-14">
          <div className="card-night relative min-h-56 p-8 md:p-12">
            {testimonials.map((testimonial, index) => (
              <blockquote
                key={testimonial.author}
                className={cn(
                  "transition-opacity duration-700",
                  index === active
                    ? "opacity-100"
                    : "pointer-events-none absolute inset-8 opacity-0 md:inset-12",
                )}
                aria-hidden={index !== active}
              >
                <p className="max-w-3xl text-lg leading-relaxed text-white/85 md:text-2xl">
                  “{testimonial.quote}”
                </p>
                <footer className="mt-6 text-sm text-dufat-sky">
                  {testimonial.author} · <cite className="not-italic text-white/60">{testimonial.organization}</cite>
                </footer>
              </blockquote>
            ))}
            <div className="mt-8 flex gap-2" role="tablist" aria-label="Testemunhos">
              {testimonials.map((testimonial, index) => (
                <button
                  key={testimonial.author}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Testemunho ${index + 1}`}
                  onClick={() => setActive(index)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === active ? "w-8 bg-dufat-sky" : "w-2 bg-white/25 hover:bg-white/50",
                  )}
                />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Client segment marquee */}
        <div className="mt-12 overflow-hidden" aria-hidden>
          <div className="flex w-max animate-marquee gap-12 motion-reduce:animate-none">
            {[...clients, ...clients].map((client, index) => (
              <span
                key={`${client}-${index}`}
                className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.25em] text-white/30"
              >
                {client}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
