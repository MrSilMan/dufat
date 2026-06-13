"use client";

import { useActionState } from "react";
import { saveProduct } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { Field, inputClass } from "@/components/forms/Field";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type Category = { id: string; name: string };

type ProductData = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  modelCode: string | null;
  categoryId: string;
  shortDescription: string;
  description: string;
  heroImage: string | null;
  priceKz: string | null;
  wattage: number | null;
  lumens: number | null;
  featured: boolean;
  published: boolean;
  has3dViewer: boolean;
  specsText: string;
};

export function ProductForm({ categories, product }: { categories: Category[]; product?: ProductData }) {
  const [state, action, pending] = useActionState(saveProduct, initialFormState);

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome" htmlFor="p-name" errors={state.errors?.name}>
          <input id="p-name" name="name" defaultValue={product?.name} required className={inputClass} />
        </Field>
        <Field label="Slug" htmlFor="p-slug" errors={state.errors?.slug}>
          <input id="p-slug" name="slug" defaultValue={product?.slug} required className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="SKU" htmlFor="p-sku" errors={state.errors?.sku} optional>
          <input id="p-sku" name="sku" defaultValue={product?.sku ?? ""} className={inputClass} />
        </Field>
        <Field label="Código do modelo" htmlFor="p-model" errors={state.errors?.modelCode} optional>
          <input id="p-model" name="modelCode" defaultValue={product?.modelCode ?? ""} className={inputClass} />
        </Field>
        <Field label="Categoria" htmlFor="p-category" errors={state.errors?.categoryId}>
          <select id="p-category" name="categoryId" defaultValue={product?.categoryId ?? ""} required className={inputClass}>
            <option value="" disabled>
              Escolher…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descrição curta" htmlFor="p-short" errors={state.errors?.shortDescription}>
        <textarea id="p-short" name="shortDescription" rows={2} defaultValue={product?.shortDescription} required className={inputClass} />
      </Field>

      <Field label="Descrição completa" htmlFor="p-description" errors={state.errors?.description}>
        <textarea id="p-description" name="description" rows={6} defaultValue={product?.description} required className={inputClass} />
      </Field>

      <ImageUploadField name="heroImage" label="Imagem principal" initialValue={product?.heroImage ?? ""} />

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Preço (Kz)" htmlFor="p-price" errors={state.errors?.priceKz} optional>
          <input id="p-price" name="priceKz" type="number" step="0.01" min={0} defaultValue={product?.priceKz ?? ""} className={inputClass} />
        </Field>
        <Field label="Potência (W)" htmlFor="p-wattage" errors={state.errors?.wattage} optional>
          <input id="p-wattage" name="wattage" type="number" min={0} defaultValue={product?.wattage ?? ""} className={inputClass} />
        </Field>
        <Field label="Fluxo (lm)" htmlFor="p-lumens" errors={state.errors?.lumens} optional>
          <input id="p-lumens" name="lumens" type="number" min={0} defaultValue={product?.lumens ?? ""} className={inputClass} />
        </Field>
      </div>

      <Field
        label="Especificações (uma por linha: Grupo | Etiqueta | Valor)"
        htmlFor="p-specs"
        errors={state.errors?.specsText}
        optional
      >
        <textarea
          id="p-specs"
          name="specsText"
          rows={8}
          defaultValue={product?.specsText}
          placeholder={"Características Gerais | Garantia | 2 Anos\nCaracterísticas do Produto | Potência | 150 W"}
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>

      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Opções de publicação</legend>
        {(
          [
            ["featured", "Destaque", product?.featured ?? false],
            ["published", "Publicado", product?.published ?? true],
            ["has3dViewer", "Visualizador 3D", product?.has3dViewer ?? false],
          ] as const
        ).map(([name, label, checked]) => (
          <label key={name} className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-dufat" />
            {label}
          </label>
        ))}
      </fieldset>

      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-amber-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-dufat px-8 py-3 font-semibold text-white transition-colors hover:bg-dufat-bright disabled:opacity-60"
      >
        {pending ? "A guardar…" : "Guardar produto"}
      </button>
    </form>
  );
}
