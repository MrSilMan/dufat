"use client";

import { useActionState } from "react";
import { saveProduct } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";
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

const toggleClass = "toggle-pill";

export function ProductForm({ categories, product }: { categories: Category[]; product?: ProductData }) {
  const [state, action, pending] = useActionState(saveProduct, initialFormState);

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}

      <FormSection title="Identificação" description="Nome público, endereço e classificação do produto.">
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField label="Nome" htmlFor="p-name" errors={state.errors?.name}>
            <input id="p-name" name="name" defaultValue={product?.name} required className={adminInputClass} />
          </AdminField>
          <AdminField label="Slug" htmlFor="p-slug" errors={state.errors?.slug} hint="Usado no endereço da página.">
            <input id="p-slug" name="slug" defaultValue={product?.slug} required className={adminInputClass} />
          </AdminField>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <AdminField label="SKU" htmlFor="p-sku" errors={state.errors?.sku} optional>
            <input id="p-sku" name="sku" defaultValue={product?.sku ?? ""} className={adminInputClass} />
          </AdminField>
          <AdminField label="Código do modelo" htmlFor="p-model" errors={state.errors?.modelCode} optional>
            <input id="p-model" name="modelCode" defaultValue={product?.modelCode ?? ""} className={adminInputClass} />
          </AdminField>
          <AdminField label="Categoria" htmlFor="p-category" errors={state.errors?.categoryId}>
            <select
              id="p-category"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              required
              className={adminInputClass}
            >
              <option value="" disabled>
                Escolher…
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminField>
        </div>
      </FormSection>

      <FormSection title="Conteúdo" description="Textos e imagem apresentados na página do produto.">
        <AdminField label="Descrição curta" htmlFor="p-short" errors={state.errors?.shortDescription}>
          <textarea
            id="p-short"
            name="shortDescription"
            rows={2}
            defaultValue={product?.shortDescription}
            required
            className={adminInputClass}
          />
        </AdminField>

        <AdminField label="Descrição completa" htmlFor="p-description" errors={state.errors?.description}>
          <textarea
            id="p-description"
            name="description"
            rows={6}
            defaultValue={product?.description}
            required
            className={adminInputClass}
          />
        </AdminField>

        <ImageUploadField name="heroImage" label="Imagem principal" initialValue={product?.heroImage ?? ""} />
      </FormSection>

      <FormSection title="Dados técnicos" description="Preço e características elétricas do produto.">
        <div className="grid gap-5 md:grid-cols-3">
          <AdminField label="Preço (Kz)" htmlFor="p-price" errors={state.errors?.priceKz} optional>
            <input
              id="p-price"
              name="priceKz"
              type="number"
              step="0.01"
              min={0}
              defaultValue={product?.priceKz ?? ""}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField label="Potência (W)" htmlFor="p-wattage" errors={state.errors?.wattage} optional>
            <input
              id="p-wattage"
              name="wattage"
              type="number"
              min={0}
              defaultValue={product?.wattage ?? ""}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField label="Fluxo (lm)" htmlFor="p-lumens" errors={state.errors?.lumens} optional>
            <input
              id="p-lumens"
              name="lumens"
              type="number"
              min={0}
              defaultValue={product?.lumens ?? ""}
              className={adminInputClass}
            />
          </AdminField>
        </div>

        <AdminField
          label="Especificações"
          htmlFor="p-specs"
          errors={state.errors?.specsText}
          optional
          hint="Uma por linha, no formato: Grupo | Etiqueta | Valor"
        >
          <textarea
            id="p-specs"
            name="specsText"
            rows={8}
            defaultValue={product?.specsText}
            placeholder={"Características Gerais | Garantia | 2 Anos\nCaracterísticas do Produto | Potência | 150 W"}
            className={`${adminInputClass} font-mono text-xs`}
          />
        </AdminField>
      </FormSection>

      <FormSection title="Publicação" description="Controla onde e como o produto aparece no site.">
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Opções de publicação</legend>
          {(
            [
              ["featured", "Destaque", product?.featured ?? false],
              ["published", "Publicado", product?.published ?? true],
              ["has3dViewer", "Visualizador 3D", product?.has3dViewer ?? false],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className={toggleClass}>
              <input
                type="checkbox"
                name={name}
                defaultChecked={checked}
                className="h-4 w-4 accent-dufat-bright"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p role="alert" className="text-sm text-rose-500">
          {state.message && !state.ok ? state.message : ""}
        </p>
        <button type="submit" disabled={pending} className="btn-admin px-8 py-3">
          {pending ? "A guardar…" : "Guardar produto"}
        </button>
      </div>
    </form>
  );
}
