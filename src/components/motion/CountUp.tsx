"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
};

/** Animated stat counter that counts up when scrolled into view. */
export function CountUp({ value, suffix = "", prefix = "", className, duration = 1.8 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      if (prefersReducedMotion()) {
        element.textContent = `${prefix}${value.toLocaleString("pt-PT")}${suffix}`;
        return;
      }
      const counter = { current: 0 };
      gsap.to(counter, {
        current: value,
        duration,
        ease: "power2.out",
        snap: { current: 1 },
        scrollTrigger: { trigger: element, start: "top 88%", once: true },
        onUpdate: () => {
          element.textContent = `${prefix}${Math.round(counter.current).toLocaleString("pt-PT")}${suffix}`;
        },
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${value}${suffix}`}>
      {prefix}0{suffix}
    </span>
  );
}
