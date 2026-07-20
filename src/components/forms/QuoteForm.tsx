"use client";

import { useActionState } from "react";
import { submitQuote } from "@/server/actions/forms";
import { initialFormState } from "@/lib/validation";
import { Field, inputClass } from "@/components/forms/Field";

type ProductOption = { slug: string; name: string };

type Props = {
  products: ProductOption[];
  initialProductSlug?: string;
};

export function QuoteForm({ products, initialProductSlug }: Props) {
  const [state, action, pending] = useActionState(submitQuote, initialFormState);

  if (state.ok) {
    return (
      <div role="status" className="card-soft p-8 text-center">
        <p className="text-3xl text-dufat-bright" aria-hidden>
          ✓
        </p>
        <h3 className="mt-3 text-xl font-bold text-ink">Pedido recebido</h3>
        <p className="mt-2 text-sm text-ink-soft">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="quote-name" errors={state.errors?.name}>
          <input id="quote-name" name="name" required className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="quote-email" errors={state.errors?.email}>
          <input
            id="quote-email"
            name="email"
            type="email"
            required
            className={inputClass}
            autoComplete="email"
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefone" htmlFor="quote-phone" errors={state.errors?.phone} optional>
          <input id="quote-phone" name="phone" className={inputClass} autoComplete="tel" />
        </Field>
        <Field label="Empresa / Instituição" htmlFor="quote-company" errors={state.errors?.company} optional>
          <input id="quote-company" name="company" className={inputClass} autoComplete="organization" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Produto" htmlFor="quote-product" errors={state.errors?.productSlug} optional>
          <select
            id="quote-product"
            name="productSlug"
            defaultValue={initialProductSlug ?? ""}
            className={inputClass}
          >
            <option value="">Vários / projeto completo</option>
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantidade estimada" htmlFor="quote-quantity" errors={state.errors?.quantity} optional>
          <input id="quote-quantity" name="quantity" type="number" min={1} className={inputClass} />
        </Field>
      </div>
      <Field label="Descreva o projeto" htmlFor="quote-message" errors={state.errors?.message}>
        <textarea
          id="quote-message"
          name="message"
          rows={5}
          required
          placeholder="Ex.: 4 km de avenida com separador central, postes de 10 m…"
          className={inputClass}
        />
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
        {pending ? "A enviar…" : "Pedir orçamento"}
      </button>
    </form>
  );
}
