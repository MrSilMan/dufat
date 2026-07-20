"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { TurntableStage } from "@/lib/three/turntableStage";
import type { TurntableVariant } from "@/lib/three/streetLightAssets";

type Props = {
  /**
   * "head" = luminária ST89 sozinha, "full" = candeeiro completo (candeeiro.glb),
   * "bollard" / "accessories" = procedural showcase products.
   */
  variant?: TurntableVariant;
  className?: string;
  /** Idle turntable speed in rad/s. */
  speed?: number;
  /** Camera framing: >1 fills the frame more (cards); defaults per variant. */
  zoom?: number;
  /** Initial rotation offset (rad) so identical models don't spin in lockstep. */
  phase?: number;
};

/** Card framing per variant — tall models fit loose, small kits fill the frame. */
const CARD_ZOOM: Record<TurntableVariant, number> = {
  head: 1.28,
  full: 1.12,
  bollard: 0.92,
  accessories: 1.5,
};

/**
 * Ambient, slowly-rotating staging of a product model on the night stage.
 * Decorative (aria-hidden): the Three bundle and the stage are created only
 * when the card approaches the viewport and torn down again once it leaves,
 * so long product listings never exhaust the browser's WebGL context limit.
 * Renders a single static frame under prefers-reduced-motion.
 */
export function LampShowcase({ variant = "head", className, speed = 0.25, zoom, phase = 0 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let stage: TurntableStage | null = null;
    let creating = false;
    let unmounted = false;
    let visible = false;
    let frame = 0;
    let rotation = -0.55 + phase;
    let last = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (!visible || !stage || still) return;
      rotation += dt * speed;
      stage.render(rotation);
    };

    const create = async () => {
      if (creating || stage || unmounted || !visible) return;
      creating = true;
      let dropped = false;
      try {
        const { createTurntableStage } = await import("@/lib/three/turntableStage");
        if (unmounted || !visible) {
          dropped = true;
          return;
        }
        const next = await createTurntableStage(canvas, variant, {
          zoom: zoom ?? CARD_ZOOM[variant],
          dress: "night",
        });
        if (unmounted || !visible) {
          next.dispose();
          dropped = true;
          return;
        }
        stage = next;
        // The lamp "warms up" once the first frame is ready.
        canvas.classList.remove("opacity-0");
        canvas.classList.add("animate-flicker-on");
        stage.render(rotation);
      } catch (error) {
        console.error("LampShowcase: failed to stage the model", error);
      } finally {
        creating = false;
        // Visibility flipped while the stage was loading — try again.
        if (dropped && visible && !unmounted) void create();
      }
    };

    const destroy = () => {
      if (!stage) return;
      stage.dispose();
      stage = null;
      canvas.classList.add("opacity-0");
      canvas.classList.remove("animate-flicker-on");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) {
          void create();
        } else {
          destroy();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(wrap);
    frame = requestAnimationFrame(loop);

    return () => {
      unmounted = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      destroy();
    };
  }, [variant, speed, zoom, phase]);

  return (
    <div ref={wrapRef} aria-hidden className={cn("pointer-events-none relative", className)}>
      <canvas ref={canvasRef} className="h-full w-full opacity-0" />
      {/* Warm pool of light under the model */}
      <div className="absolute inset-x-[18%] bottom-[3%] h-10 rounded-[100%] bg-lumen/30 blur-2xl" />
    </div>
  );
}
