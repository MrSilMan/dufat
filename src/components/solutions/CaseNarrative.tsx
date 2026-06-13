"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

export type CaseStudyData = {
  id: string;
  slug: string;
  title: string;
  client: string;
  location: string;
  summary: string;
  body: string;
  heroImage: string | null;
  stats: unknown;
};

type Stat = { label: string; value: string };

function parseStats(stats: unknown): Stat[] {
  if (!Array.isArray(stats)) return [];
  return stats.filter(
    (entry): entry is Stat =>
      typeof entry === "object" && entry !== null && "label" in entry && "value" in entry,
  );
}

/**
 * Full-bleed, pinned scroll narrative for one case study: the backdrop
 * slowly zooms while title → story → stats take turns on stage.
 */
export function CaseNarrative({ study, index }: { study: CaseStudyData; index: number }) {
  const wrapRef = useRef<HTMLElement>(null);
  const stats = parseStats(study.stats);
  const paragraphs = study.body.split("\n\n").slice(0, 3);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !wrapRef.current) return;
      const root = wrapRef.current;

      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
      });

      timeline.fromTo("[data-backdrop]", { scale: 1.15 }, { scale: 1, duration: 1, ease: "none" }, 0);
      timeline.fromTo("[data-title]", { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.02);
      timeline.to("[data-title]", { autoAlpha: 0, y: -60, duration: 0.1 }, 0.3);
      paragraphs.forEach((_, paragraphIndex) => {
        const start = 0.34 + paragraphIndex * 0.14;
        timeline.fromTo(
          `[data-paragraph="${paragraphIndex}"]`,
          { autoAlpha: 0, y: 60 },
          { autoAlpha: 1, y: 0, duration: 0.1 },
          start,
        );
        timeline.to(`[data-paragraph="${paragraphIndex}"]`, { autoAlpha: 0, y: -40, duration: 0.08 }, start + 0.12);
      });
      timeline.fromTo("[data-stats]", { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.84);
      timeline.set({}, {}, 1);
    },
    { scope: wrapRef },
  );

  return (
    <section
      ref={wrapRef}
      aria-labelledby={`case-${study.slug}`}
      className="relative h-[280vh] motion-reduce:h-auto"
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden motion-reduce:static motion-reduce:h-auto motion-reduce:py-24">
        <div data-backdrop className="absolute inset-0">
          <Image
            src={study.heroImage ?? "/images/cases/kilamba.svg"}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-50"
            priority={index === 0}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-night" />
        </div>

        {/* Title beat */}
        <div data-title className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center motion-reduce:static motion-reduce:opacity-100">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">
            {study.location} · {study.client}
          </p>
          <h2 id={`case-${study.slug}`} className="mt-4 max-w-3xl text-4xl font-black md:text-6xl">
            {study.title}
          </h2>
          <p className="mt-5 max-w-xl text-white/75">{study.summary}</p>
        </div>

        {/* Story beats */}
        {paragraphs.map((paragraph, paragraphIndex) => (
          <p
            key={paragraphIndex}
            data-paragraph={paragraphIndex}
            className="invisible absolute max-w-2xl px-6 text-center text-lg leading-relaxed text-white/85 opacity-0 md:text-2xl motion-reduce:visible motion-reduce:static motion-reduce:mt-6 motion-reduce:opacity-100"
          >
            {paragraph}
          </p>
        ))}

        {/* Stats beat */}
        <div
          data-stats
          className="invisible absolute inset-x-0 bottom-0 top-auto px-6 pb-20 opacity-0 motion-reduce:visible motion-reduce:static motion-reduce:mt-8 motion-reduce:pb-0 motion-reduce:opacity-100"
        >
          <div className="container-site grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="card-night p-6 text-center">
                <p className="font-display text-3xl font-black text-dufat-sky">{stat.value}</p>
                <p className="mt-1 text-sm text-white/65">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
