"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  className?: string;
  /** Vertical offset the element travels while fading in. */
  y?: number;
  delay?: number;
  /** Stagger children matching this selector instead of the wrapper itself. */
  stagger?: string;
};

/** Fades content in (with a slide) when it scrolls into view. */
export function Reveal({ children, className, y = 36, delay = 0, stagger }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      const targets = stagger ? ref.current.querySelectorAll(stagger) : ref.current;
      gsap.from(targets, {
        y,
        autoAlpha: 0,
        duration: 0.9,
        delay,
        ease: "power3.out",
        stagger: stagger ? 0.12 : 0,
        // Once revealed, drop the inline transform/opacity so grid items can
        // never be left sitting misaligned by an interrupted tween.
        clearProps: "transform,opacity,visibility",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          once: true,
          invalidateOnRefresh: true,
        },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
