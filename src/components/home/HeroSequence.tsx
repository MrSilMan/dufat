"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { detectQuality } from "@/lib/three/quality";
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

/**
 * The flagship interaction: a pinned, scroll-scrubbed Three.js street light
 * that the camera tears down component by component while annotation panels
 * with leader lines fade in, and the sky cycles dusk → night → dawn.
 */
export default function HeroSequence() {
  const wrapRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HeroScene | null>(null);
  const panelRefs = useRef(new Map<string, HTMLDivElement>());
  const leaderRefs = useRef(new Map<string, SVGLineElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());
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
        reducedMotion: mode === "static",
      });
      sceneRef.current = scene;
      if (mode === "static") {
        scene.setProgress(0.4); // a pleasing night-time frame
      } else {
        scene.start();
      }
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
        <div className="relative h-[70vh]">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night to-transparent p-8">
            <div className="container-site">
              <h1 className="max-w-2xl text-4xl font-black md:text-5xl">
                Iluminamos o futuro de Angola
              </h1>
              <p className="mt-3 max-w-xl text-white/70">
                Iluminação pública LED, postes galvanizados e material elétrico profissional.
              </p>
            </div>
          </div>
        </div>
        <div className="container-site grid gap-6 py-16 md:grid-cols-2">
          {HERO_STAGES.map((stage) => (
            <article key={stage.id} className="card-night p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-dufat-sky">
                {stage.kicker}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold">{stage.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
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
          <DufatLogo className="h-12 animate-pulse-soft" />
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
          <h1 className="max-w-3xl px-6 text-4xl font-black leading-tight md:text-6xl">
            Iluminamos o futuro{" "}
            <span className="bg-gradient-to-r from-dufat-sky to-dufat-bright bg-clip-text text-transparent">
              de Angola
            </span>
          </h1>
          <p className="mt-4 max-w-xl px-6 text-base text-white/70 md:text-lg">
            Iluminação pública LED, postes galvanizados e material elétrico — explore o nosso
            candeeiro, peça a peça.
          </p>
          <div className="mt-10 flex flex-col items-center gap-2 text-dufat-sky/80">
            <span className="text-xs uppercase tracking-[0.3em]">Role para explorar</span>
            <span aria-hidden className="block h-9 w-5 rounded-full border border-dufat-sky/50 p-1">
              <span className="block h-2 w-full animate-bounce rounded-full bg-dufat-sky" />
            </span>
          </div>
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
            <article className="card-night p-6 md:p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-dufat-sky">
                {stage.kicker}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">{stage.title}</h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/80">
                {stage.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-dufat-sky" />
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
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-dufat-sky">
            Amanheceu — missão cumprida
          </p>
          <h2 className="mt-4 max-w-3xl px-6 text-3xl font-black md:text-5xl">
            Do poste ao lúmen, tudo num só fornecedor.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 px-6">
            <Link
              href="/products"
              className="rounded-full bg-dufat px-8 py-3.5 font-semibold text-white transition-all hover:bg-dufat-bright hover:glow-blue"
            >
              Ver catálogo
            </Link>
            <Link
              href="/contact?tab=orcamento"
              className="rounded-full border border-dufat-sky/40 px-8 py-3.5 font-semibold text-dufat-sky transition-colors hover:bg-dufat-sky/10"
            >
              Pedir orçamento
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
