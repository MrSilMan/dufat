"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  className?: string;
  /** Positive values move slower than the page (background), negative faster (foreground). */
  speed?: number;
};

/** Scroll-scrubbed parallax translation for layered marketing sections. */
export function Parallax({ children, className, speed = 0.25 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      const distance = speed * 160;
      gsap.fromTo(
        ref.current,
        { y: distance },
        {
          y: -distance,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
