"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

/**
 * Animated comparison between the LED luminaire and the equivalent
 * high-pressure sodium fixture it replaces (~2.5x the wattage).
 */
export function EnergyChart({ wattage, lumens }: { wattage: number; lumens: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const sodiumWattage = Math.round(wattage * 2.5);
  // 4 380 h/year ≈ 12 h of operation per night.
  const ledKwh = Math.round((wattage * 4380) / 1000);
  const sodiumKwh = Math.round((sodiumWattage * 4380) / 1000);
  const savings = Math.round((1 - ledKwh / sodiumKwh) * 100);

  useGSAP(
    () => {
      if (!ref.current) return;
      const bars = ref.current.querySelectorAll<HTMLElement>("[data-bar]");
      if (prefersReducedMotion()) {
        bars.forEach((bar) => {
          bar.style.width = bar.dataset.bar ?? "100%";
        });
        return;
      }
      bars.forEach((bar) => {
        gsap.fromTo(
          bar,
          { width: "0%" },
          {
            width: bar.dataset.bar,
            duration: 1.4,
            ease: "power3.out",
            scrollTrigger: { trigger: ref.current, start: "top 80%", once: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="card-soft p-6 md:p-8">
      <h3 className="text-lg font-bold text-ink">Consumo anual por ponto de luz</h3>
      <p className="mt-1 text-sm text-ink-faint">12 h de funcionamento por noite (4 380 h/ano)</p>

      <div className="mt-6 space-y-5">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Vapor de sódio {sodiumWattage} W</span>
            <span className="font-semibold text-ink-soft">{sodiumKwh} kWh</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-dufat/10">
            <div data-bar="100%" className="h-full rounded-full bg-lumen" style={{ width: 0 }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">LED ST89 {wattage} W</span>
            <span className="font-semibold text-dufat">{ledKwh} kWh</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-dufat/10">
            <div
              data-bar={`${Math.round((ledKwh / sodiumKwh) * 100)}%`}
              className="h-full rounded-full bg-dufat-bright"
              style={{ width: 0 }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-6 border-t border-line pt-5 text-sm">
        <p>
          <span className="font-display text-3xl font-black text-dufat">-{savings}%</span>
          <span className="ml-2 text-ink-soft">de energia</span>
        </p>
        <p>
          <span className="font-display text-3xl font-black text-ink">{Math.round(lumens / wattage)}</span>
          <span className="ml-2 text-ink-soft">lm/W de eficiência</span>
        </p>
      </div>
    </div>
  );
}
