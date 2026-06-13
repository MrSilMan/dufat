"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Fire-and-forget page view beacon for the admin analytics dashboard. */
export function TrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body, keepalive: true });
      }
    } catch {
      // analytics must never break navigation
    }
  }, [pathname]);

  return null;
}
