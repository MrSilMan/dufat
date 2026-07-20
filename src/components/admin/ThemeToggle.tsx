"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "@/components/admin/icons";
import { cn } from "@/lib/cn";

export const ADMIN_THEME_KEY = "dufat-admin-theme";

type Theme = "dark" | "light";

/**
 * Runs in <head> before any admin markup is parsed, so the shell paints with
 * the saved theme directly and never animates from the default.
 *
 * The admin shell doesn't exist yet at this point, so the attribute goes on
 * <html> and the shell inherits it via `[data-admin-theme="light"] .admin-shell`.
 * Kept in sync with ADMIN_THEME_KEY and the CSS in globals.css.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${ADMIN_THEME_KEY}');document.documentElement.setAttribute('data-admin-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-admin-theme','dark');}})();`;

/* ---- external store: the data-theme attribute on the admin shell ---- */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-admin-theme") === "light"
    ? "light"
    : "dark";
}

// The server always renders the default; the init script sets the real
// attribute before paint, and useSyncExternalStore reads it on mount without a
// hydration mismatch on the markup.
function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-admin-theme", next);
  try {
    localStorage.setItem(ADMIN_THEME_KEY, next);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
  notify();
}

type Props = {
  /** "full" shows an icon + label pill; "icon" is a compact square button. */
  variant?: "full" | "icon";
  className?: string;
};

export function ThemeToggle({ variant = "full", className }: Props) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";
  const nextLabel = isDark ? "Modo claro" : "Modo escuro";
  const Icon = isDark ? IconSun : IconMoon;

  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        title={nextLabel}
        aria-label={nextLabel}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-a-muted transition-colors hover:bg-a-hover hover:text-a-text",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={nextLabel}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-a-muted transition-colors hover:bg-a-hover hover:text-a-text",
        className,
      )}
    >
      <Icon className="h-4 w-4 text-a-faint" />
      <span>{nextLabel}</span>
    </button>
  );
}
