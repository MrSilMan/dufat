"use client";

import { useActionState } from "react";
import { submitContact } from "@/server/actions/forms";
import { initialFormState } from "@/lib/validation";
import { Field, inputClass } from "@/components/forms/Field";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initialFormState);

  if (state.ok) {
    return (
      <div role="status" className="card-soft p-8 text-center">
        <p className="text-3xl text-dufat-bright" aria-hidden>
          ✓
        </p>
        <h3 className="mt-3 text-xl font-bold text-ink">Mensagem enviada</h3>
        <p className="mt-2 text-sm text-ink-soft">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="contact-name" errors={state.errors?.name}>
          <input id="contact-name" name="name" required className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="contact-email" errors={state.errors?.email}>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            className={inputClass}
            autoComplete="email"
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefone" htmlFor="contact-phone" errors={state.errors?.phone} optional>
          <input id="contact-phone" name="phone" className={inputClass} autoComplete="tel" />
        </Field>
        <Field label="Assunto" htmlFor="contact-subject" errors={state.errors?.subject}>
          <input id="contact-subject" name="subject" required className={inputClass} />
        </Field>
      </div>
      <Field label="Mensagem" htmlFor="contact-message" errors={state.errors?.message}>
        <textarea id="contact-message" name="message" rows={5} required className={inputClass} />
      </Field>

      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-amber-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-dufat px-8 py-3.5 font-semibold text-white transition-all hover:bg-dufat-bright hover:glow-blue disabled:opacity-60"
      >
        {pending ? "A enviar…" : "Enviar mensagem"}
      </button>
    </form>
  );
}
