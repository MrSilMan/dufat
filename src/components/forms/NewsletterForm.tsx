"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/server/actions/forms";
import { initialFormState } from "@/lib/validation";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, initialFormState);

  return (
    <form action={action} className="mt-4">
      <div className="flex max-w-sm gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="o.seu@email.com"
          className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-dufat-bright"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-dufat px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dufat-bright disabled:opacity-60"
        >
          {pending ? "A subscrever…" : "Subscrever"}
        </button>
      </div>
      <p
        role="status"
        className={`mt-2 min-h-5 text-sm ${state.ok ? "text-emerald-600" : "text-lumen-deep"}`}
      >
        {state.message ?? state.errors?.email?.[0] ?? ""}
      </p>
    </form>
  );
}
