"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/cn";
import { isLitVariant } from "@/lib/three/showcaseVariants";
import type { TurntableVariant } from "@/lib/three/streetLightAssets";

/**
 * Interactive turntable of the real product model (candeeiro.glb): the ST89
 * luminaire head or the complete street light. Scroll-scrubbed with pointer
 * drag override, gentle idle rotation, and a working LED on/off switch.
 * Lazy-loads the Three bundle on mount.
 */
export function ProductViewer360({
  label,
  variant = "head",
}: {
  label: string;
  variant?: TurntableVariant;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    scroll: 0,
    drag: 0,
    pitch: 0,
    idle: 0,
    led: 1,
    setLed: (_: number) => {},
    dispose: () => {},
  });
  const [ready, setReady] = useState(false);
  const [ledOn, setLedOn] = useState(true);
  // Parts sold on their own (braço, poste, base, portinhola) carry no LED —
  // the photocell switch would toggle nothing.
  const lit = isLitVariant(variant);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let frame = 0;
    const state = stateRef.current;

    void (async () => {
      const { createTurntableStage } = await import("@/lib/three/turntableStage");
      let stage: Awaited<ReturnType<typeof createTurntableStage>>;
      try {
        stage = await createTurntableStage(canvas, variant);
      } catch (error) {
        console.error("ProductViewer360: failed to load candeeiro.glb", error);
        return;
      }
      if (cancelled) {
        stage.dispose();
        return;
      }
      state.setLed = stage.setLed;
      stage.setLed(state.led);
      setReady(true);

      const still = prefersReducedMotion();
      let last = performance.now();
      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        const dt = Math.min(now - last, 100) / 1000;
        last = now;
        if (!still) state.idle += dt * 0.12;
        stage.render(state.scroll * Math.PI * 2 + state.drag + state.idle, state.pitch);
      };
      loop(last);

      state.dispose = () => {
        cancelAnimationFrame(frame);
        stage.dispose();
      };
    })();

    return () => {
      cancelled = true;
      state.dispose();
      state.dispose = () => {};
    };
  }, [variant]);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !wrapRef.current) return;
      const state = stateRef.current;
      gsap.to(state, {
        scroll: 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      });
    },
    { scope: wrapRef },
  );

  const toggleLed = () => {
    const next = !ledOn;
    setLedOn(next);
    const state = stateRef.current;
    gsap.to(state, {
      led: next ? 1 : 0,
      duration: 0.7,
      ease: next ? "power4.in" : "power2.out",
      onUpdate: () => state.setLed(state.led),
    });
  };

  // Pointer drag for manual inspection: horizontal spins the turntable,
  // vertical pitches it (clamped so the model can't flip). Touch keeps
  // vertical gestures for page scrolling (touch-pan-y), so only mouse/pen
  // get the pitch axis.
  const dragging = useRef({ active: false, lastX: 0, lastY: 0 });
  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current.active) return;
    const state = stateRef.current;
    state.drag += (event.clientX - dragging.current.lastX) * 0.008;
    if (event.pointerType !== "touch") {
      const pitch = state.pitch + (event.clientY - dragging.current.lastY) * 0.006;
      state.pitch = Math.min(0.7, Math.max(-0.7, pitch));
    }
    dragging.current.lastX = event.clientX;
    dragging.current.lastY = event.clientY;
  };
  const onPointerUp = () => {
    dragging.current.active = false;
  };

  return (
    <div ref={wrapRef} className="relative h-[60vh] min-h-96 w-full md:h-[70vh]">
      {/* Studio backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_50%_32%,#ffffff,#dce9f7_75%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_44px_-22px_rgba(17,79,140,0.3)]"
      >
        <div
          className={cn(
            "absolute inset-x-[22%] bottom-[7%] h-14 rounded-[100%] bg-lumen/30 blur-2xl transition-opacity duration-700",
            ledOn && lit ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Modelo 3D interativo: ${label}. Arraste para rodar.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          "relative h-full w-full cursor-grab touch-pan-y transition-opacity duration-700 active:cursor-grabbing",
          ready ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Loading shimmer */}
      {!ready && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 animate-pulse-soft rounded-full bg-dufat-bright shadow-[0_0_18px_rgba(45,119,201,0.7)]" />
        </div>
      )}

      {/* LED photocell switch — only where there is an LED to switch */}
      {lit && (
      <button
        type="button"
        onClick={toggleLed}
        aria-pressed={ledOn}
        className={cn(
          "absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs tracking-wider transition-all duration-300",
          ledOn
            ? "border-lumen/60 bg-lumen/15 text-lumen-deep glow-warm"
            : "border-line bg-white/85 text-ink-faint hover:border-dufat/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 rounded-full transition-all duration-300",
            ledOn ? "bg-lumen shadow-[0_0_10px_rgba(255,185,86,1)]" : "bg-ink-faint/40",
          )}
        />
        LED {ledOn ? "ON" : "OFF"}
      </button>
      )}
    </div>
  );
}
