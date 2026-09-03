"use client";

import { useId, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { adminInputClass } from "@/components/admin/ui";
import { IconEye, IconEyeOff } from "@/components/admin/icons";

type Props = Omit<ComponentPropsWithoutRef<"input">, "type">;

/**
 * A password field with a reveal toggle.
 *
 * Every one of these is typed blind on a phone, and half of them are a password
 * someone is reading off a note or hearing down a line — "did I type it right"
 * is a question the form should be able to answer, rather than one that costs a
 * failed sign-in to ask.
 *
 * Starts hidden and never persists the revealed state: the point is a glance to
 * check a typo, not a password left legible on a screen someone walks away from.
 */
export function PasswordInput({ className, ...props }: Props) {
  const [visivel, setVisivel] = useState(false);
  const rotulo = useId();

  return (
    <div className="relative">
      <input
        {...props}
        type={visivel ? "text" : "password"}
        // Room for the button, so a long password never runs underneath it.
        className={cn(adminInputClass, "pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-pressed={visivel}
        aria-label={visivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
        aria-describedby={rotulo}
        // Inset rather than beside the field: at 360px the field already uses
        // the full width, and a button outside it would shrink the input.
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-a-faint transition-colors hover:text-a-text focus-visible:text-a-text"
      >
        {visivel ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
      </button>
      <span id={rotulo} className="sr-only">
        A palavra-passe está {visivel ? "visível" : "oculta"}.
      </span>
    </div>
  );
}
