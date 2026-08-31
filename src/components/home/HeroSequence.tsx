"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { detectQuality, shouldLoadSkyline } from "@/lib/three/quality";
import { SKYLINE_URL, STREET_LIGHT_URL } from "@/lib/three/assetUrls";
import { HERO_STAGES, FINAL_WINDOW } from "@/content/heroStages";
import { DufatLogo } from "@/components/brand/DufatLogo";
import { cn } from "@/lib/cn";
import type { HeroScene } from "@/lib/three/HeroScene";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(callback: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** "full" | "static" on the client, null during SSR/hydration. */
function useMotionMode(): "full" | "static" | null {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => (window.matchMedia(REDUCED_MOTION_QUERY).matches ? "static" : "full"),
    () => null,
  );
}

type HeroProps = {
  /** Admin-editable hero copy (src/lib/settings.ts supplies the defaults). */
  eyebrow: string;
  headline: string;
  /** Tail of the headline that receives the gradient. May be empty. */
  highlight: string;
  subtitle: string;
  scrollHint: string;
  logoUrl?: string | null;
};

/**
 * The flagship interaction: a pinned, scroll-scrubbed Three.js street light
 * that the camera tears down component by component while annotation panels
 * with leader lines fade in, and the sky cycles dusk → night → dawn.
 */
export default function HeroSequence({
  eyebrow,
  headline,
  highlight,
  subtitle,
  scrollHint,
  logoUrl,
}: HeroProps) {
  // Start the (large) GLB download with the HTML itself, well before the
  // three.js chunk loads and asks for it. crossOrigin must match the loader's
  // fetch mode or the browser re-downloads instead of reusing the preload.
  preload(STREET_LIGHT_URL, { as: "fetch", crossOrigin: "anonymous" });
  // The city doesn't gate the reveal (it fades in when it lands), but the
  // sooner it downloads the sooner that happens. SkylinePreload's inline
  // script already started this download from the SSR HTML; this client-side
  // call is a dedupe/fallback (the browser reuses an in-flight preload for
  // the same URL/as/crossOrigin), kept so the hero works standalone too.
  if (typeof window !== "undefined" && shouldLoadSkyline()) {
    preload(SKYLINE_URL, { as: "fetch", crossOrigin: "anonymous" });
  }

  const wrapRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HeroScene | null>(null);
  const panelRefs = useRef(new Map<string, HTMLDivElement>());
  const leaderRefs = useRef(new Map<string, SVGLineElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());
  const railRefs = useRef(new Map<string, HTMLSpanElement>());
  const introRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  const mode = useMotionMode();
  const [ready, setReady] = useState(false);

  // Lazily create the (heavy) Three.js scene once we know the motion mode.
  useEffect(() => {
    if (!mode || !canvasRef.current) return;
    let cancelled = false;
    let scene: HeroScene | undefined;

    void (async () => {
      const { HeroScene: Scene } = await import("@/lib/three/HeroScene");
      if (cancelled || !canvasRef.current) return;
      scene = new Scene(canvasRef.current, {
        quality: detectQuality(),
        skyline: shouldLoadSkyline(),
        reducedMotion: mode === "static",
      });
      sceneRef.current = scene;
      if (mode === "static") {
        scene.setProgress(0.4); // a pleasing night-time frame
      } else {
        scene.start();
      }
      // Hold the branded loader only until the street light is in the scene;
      // the (much larger) city GLB fades in through the fog whenever it lands.
      await scene.whenReady();
      if (cancelled) return;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [mode]);

  useGSAP(
    () => {
      if (mode !== "full" || !ready || !wrapRef.current) return;
      const wrap = wrapRef.current;
      const sticky = wrap.querySelector<HTMLElement>("[data-hero-sticky]")!;

      const positionLeaders = () => {
        const scene = sceneRef.current;
        if (!scene) return;
        const bounds = sticky.getBoundingClientRect();
        for (const stage of HERO_STAGES) {
          const line = leaderRefs.current.get(stage.id);
          const dot = dotRefs.current.get(stage.id);
          const panel = panelRefs.current.get(stage.id);
          if (!line || !panel || !dot) continue;
          const anchor = scene.projectPart(stage.part);
          const panelBox = panel.getBoundingClientRect();
          const x1 =
            stage.side === "left" ? panelBox.right - bounds.left : panelBox.left - bounds.left;
          const y1 = panelBox.top + panelBox.height / 2 - bounds.top;
          const x2 = (anchor.x / 100) * bounds.width;
          const y2 = (anchor.y / 100) * bounds.height;
          line.setAttribute("x1", String(x1));
          line.setAttribute("y1", String(y1));
          line.setAttribute("x2", String(x2));
          line.setAttribute("y2", String(y2));
          dot.setAttribute("cx", String(x2));
          dot.setAttribute("cy", String(y2));
        }
      };

      // Smoothed scrub that drives the 3D camera + sky.
      const proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrap,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
        },
        onUpdate: () => {
          sceneRef.current?.setProgress(proxy.p);
          positionLeaders();
          // Light up the stage rail dot for the active teardown step.
          for (const stage of HERO_STAGES) {
            const railDot = railRefs.current.get(stage.id);
            if (!railDot) continue;
            const active = proxy.p >= stage.window[0] && proxy.p < stage.window[1];
            railDot.dataset.active = active ? "true" : "false";
          }
        },
      });

      // Annotation choreography shares the same scroll range (duration = 1).
      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: wrap,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });

      if (introRef.current) {
        timeline.to(introRef.current, { autoAlpha: 0, y: -50, duration: 0.05 }, 0.02);
      }

      for (const stage of HERO_STAGES) {
        const panel = panelRefs.current.get(stage.id);
        const line = leaderRefs.current.get(stage.id);
        const dot = dotRefs.current.get(stage.id);
        if (!panel) continue;
        const [start, end] = stage.window;
        const slide = stage.side === "left" ? -60 : 60;
        const fadeIn = Math.min(0.045, (end - start) * 0.35);

        timeline.fromTo(
          panel,
          { autoAlpha: 0, x: slide },
          { autoAlpha: 1, x: 0, duration: fadeIn },
          start,
        );
        if (line && dot) {
          timeline.fromTo([line, dot], { autoAlpha: 0 }, { autoAlpha: 1, duration: fadeIn }, start + 0.01);
          timeline.to([line, dot], { autoAlpha: 0, duration: fadeIn }, end - fadeIn);
        }
        timeline.to(panel, { autoAlpha: 0, x: slide / 2, duration: fadeIn }, end - fadeIn);
      }

      if (finalRef.current) {
        timeline.fromTo(
          finalRef.current,
          { autoAlpha: 0, y: 70 },
          { autoAlpha: 1, y: 0, duration: 0.06 },
          FINAL_WINDOW[0],
        );
      }
      // Normalize total duration to exactly 1 so windows map 1:1 to progress.
      timeline.set({}, {}, 1);

      // The hero pin changes page scroll heights, so other ScrollTriggers
      // (e.g. Reveal cards below) need to recalculate their trigger positions.
      ScrollTrigger.refresh();

      window.addEventListener("resize", positionLeaders);
      return () => window.removeEventListener("resize", positionLeaders);
    },
    { scope: wrapRef, dependencies: [mode, ready] },
  );

  // ---------- reduced-motion fallback: static frame + stacked cards ----------
  if (mode === "static") {
    return (
      <section aria-label="Apresentação do candeeiro de rua Dufat">
        <div data-hero-dark className="relative h-[70vh]">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night to-transparent p-8">
            <div className="container-site">
              <h1 className="max-w-2xl text-4xl font-black text-white md:text-5xl">
                {[headline, highlight].filter(Boolean).join(" ")}
              </h1>
              <p className="mt-3 max-w-xl text-white/70">{subtitle}</p>
              {/* The reduced-motion path gets the same two entry points. */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/products" className="btn-primary px-7 py-3.5">
                  Ver catálogo
                </Link>
                <Link
                  href="/contact?tab=orcamento"
                  className="inline-flex items-center justify-center rounded-full border border-white/60 px-7 py-3.5 font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
                >
                  Pedir orçamento
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="container-site grid gap-6 py-16 md:grid-cols-2">
          {HERO_STAGES.map((stage) => (
            <article key={stage.id} className="card-soft p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-dufat-bright">
                {stage.kicker}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-ink">{stage.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                {stage.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={wrapRef}
      data-hero-dark
      aria-label="Apresentação interativa do candeeiro de rua Dufat"
      className="relative h-[680vh]"
    >
      <div data-hero-sticky className="sticky top-0 h-screen overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Branded loading state while the 3D scene initializes */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-night transition-opacity duration-700",
            ready ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <DufatLogo className="h-12 animate-pulse-soft" logoUrl={logoUrl} />
          <p className="text-xs uppercase tracking-[0.3em] text-dufat-sky/70">A preparar a luz…</p>
        </div>

        {/* Leader lines from annotation panels to 3D parts */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          {HERO_STAGES.map((stage) => (
            <g key={stage.id}>
              <line
                ref={(node) => {
                  if (node) leaderRefs.current.set(stage.id, node);
                }}
                stroke="#8FC3FF"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0"
              />
              <circle
                ref={(node) => {
                  if (node) dotRefs.current.set(stage.id, node);
                }}
                r="5"
                fill="none"
                stroke="#8FC3FF"
                strokeWidth="2"
                opacity="0"
              />
            </g>
          ))}
        </svg>

        {/* Landing headline */}
        <div
          ref={introRef}
          className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-24 text-center"
        >
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 font-mono text-xs tracking-wide text-white/90 backdrop-blur-sm">
            {eyebrow}
          </p>
          <h1 className="max-w-3xl px-6 text-4xl font-black leading-tight text-white md:text-6xl">
            {headline}
            {highlight && (
              <>
                {" "}
                <span className="bg-gradient-to-r from-dufat-sky to-lumen bg-clip-text text-transparent">
                  {highlight}
                </span>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl px-6 text-base text-white/70 md:text-lg">{subtitle}</p>

          {/* Business first: the teardown is 680vh long, so the two things a
              visitor might actually want must be reachable before any of it. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 px-6">
            <Link href="/products" className="btn-primary px-7 py-3.5">
              Ver catálogo
            </Link>
            <Link
              href="/contact?tab=orcamento"
              className="inline-flex items-center justify-center rounded-full border border-white/60 px-7 py-3.5 font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
            >
              Pedir orçamento
            </Link>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 text-dufat-sky/80">
            <span className="text-xs uppercase tracking-[0.3em]">{scrollHint}</span>
            <span aria-hidden className="block h-9 w-5 rounded-full border border-dufat-sky/50 p-1">
              <span className="block h-2 w-full animate-bounce rounded-full bg-dufat-sky" />
            </span>
          </div>
        </div>

        {/* Escape hatch for the whole sequence. Outside the intro block, so it
            survives the fade at 7% and stays reachable for all 680vh. Anchored
            bottom-left to clear the floating WhatsApp button. */}
        <a
          href="#catalogo"
          className="absolute bottom-6 left-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/25 bg-night-soft/60 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-sm transition-colors hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lumen md:left-8"
        >
          Saltar para os produtos
          <span aria-hidden>↓</span>
        </a>

        {/* Stage progress rail */}
        <div
          aria-hidden
          className="absolute right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex"
        >
          {HERO_STAGES.map((stage) => (
            <span
              key={stage.id}
              ref={(node) => {
                if (node) railRefs.current.set(stage.id, node);
              }}
              data-active="false"
              className="h-2 w-2 rounded-full bg-white/20 transition-all duration-300 data-[active=true]:scale-150 data-[active=true]:bg-lumen data-[active=true]:shadow-[0_0_12px_rgba(255,185,86,0.9)]"
            />
          ))}
        </div>

        {/* Component annotation panels */}
        {HERO_STAGES.map((stage) => (
          <div
            key={stage.id}
            ref={(node) => {
              if (node) panelRefs.current.set(stage.id, node);
            }}
            className={cn(
              "invisible absolute top-1/2 z-20 w-[19rem] max-w-[80vw] -translate-y-1/2 opacity-0 md:w-[22rem]",
              stage.side === "left" ? "left-6 md:left-16" : "right-6 md:right-16",
            )}
          >
            <article className="rounded-2xl border border-white/40 bg-white/90 p-6 shadow-[0_24px_60px_-20px_rgba(4,9,15,0.6)] backdrop-blur-md md:p-7">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-lumen-deep">
                {stage.kicker}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-ink md:text-3xl">{stage.title}</h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
                {stage.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-lumen" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        ))}

        {/* Closing CTA as dawn breaks and the photocell switches the lamp off */}
        <div
          ref={finalRef}
          className="invisible absolute inset-0 z-20 flex flex-col items-center justify-center text-center opacity-0"
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-lumen/90">
            Amanheceu — missão cumprida
          </p>
          <h2 className="mt-4 max-w-3xl px-6 text-3xl font-black text-white md:text-5xl">
            Do poste ao lúmen,{" "}
            <span className="bg-gradient-to-r from-dufat-sky to-white bg-clip-text text-transparent">
              tudo num só fornecedor.
            </span>
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 px-6">
            <Link href="/products" className="btn-primary px-8 py-3.5">
              Ver catálogo
            </Link>
            {/* Not btn-ghost: that utility is a dark-blue outline for light
                pages and disappears against this dark hero. Explicit white pill
                so it reads next to the blue primary. */}
            <Link
              href="/contact?tab=orcamento"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
            >
              Pedir orçamento
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
