"use client";

import { useActionState, useState } from "react";
import { saveProduct } from "@/server/actions/admin";
import { initialFormState, NEW_CATEGORY_VALUE } from "@/lib/validation";
import {
  TURNTABLE_VARIANTS,
  TURNTABLE_VARIANT_LABELS,
} from "@/lib/three/showcaseVariants";
import {
  AdminField,
  FormActions,
  FormLayout,
  FormSection,
  SwitchGroup,
  SwitchRow,
  adminInputClass,
} from "@/components/admin/ui";
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
  viewer3dVariant: string | null;
  specsText: string;
};

export function ProductForm({ categories, product }: { categories: Category[]; product?: ProductData }) {
  const [state, action, pending] = useActionState(saveProduct, initialFormState);
  // The 3D viewer is opt-in per product; the model picker only matters once it is on.
  const [show3d, setShow3d] = useState(product?.has3dViewer ?? false);
  // Kept in state so the stored model survives toggling the viewer off — the
  // hidden mirror below submits it while the select is out of the DOM.
  const [variant, setVariant] = useState(product?.viewer3dVariant ?? "");
  // Controls the inline "+ Nova categoria" name field.
  const [categoryValue, setCategoryValue] = useState(product?.categoryId ?? "");

  return (
    // Cancel React 19's automatic post-action form reset so a validation error
    // keeps every field the admin typed — including the "+ Nova categoria"
    // selection and name — instead of silently reverting them.
    <form action={action} onReset={(event) => event.preventDefault()} noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}

      <FormLayout
        /* ---------- Sidebar: how the product is presented ---------- */
        aside={
          <>
            <FormSection title="Publicação">
              <SwitchGroup legend="Opções de publicação">
                <SwitchRow
                  name="published"
                  label="Publicado"
                  hint="Visível no catálogo do site."
                  defaultChecked={product?.published ?? true}
                />
                <SwitchRow
                  name="featured"
                  label="Destaque"
                  hint="Aparece na página inicial."
                  defaultChecked={product?.featured ?? false}
                />
                <SwitchRow
                  name="has3dViewer"
                  label="Visualizador 3D"
                  hint="Mostra um modelo em vez da imagem."
                  checked={show3d}
                  onChange={setShow3d}
                />
              </SwitchGroup>

              {show3d ? (
                <AdminField label="Modelo 3D" htmlFor="p-viewer3d" errors={state.errors?.viewer3dVariant}>
                  <select
                    id="p-viewer3d"
                    name="viewer3dVariant"
                    value={variant}
                    onChange={(event) => setVariant(event.target.value)}
                    className={adminInputClass}
                  >
                    <option value="">Automático (pela categoria)</option>
                    {TURNTABLE_VARIANTS.map((variantOption) => (
                      <option key={variantOption} value={variantOption}>
                        {TURNTABLE_VARIANT_LABELS[variantOption]}
                      </option>
                    ))}
                  </select>
                </AdminField>
              ) : (
                // Mirror the stored model while the select is hidden — an absent
                // field would silently clear it whenever 3D is toggled off.
                <input type="hidden" name="viewer3dVariant" value={variant} />
              )}
            </FormSection>

            <FormSection title="Imagem principal">
              <ImageUploadField
                name="heroImage"
                label="Imagem principal"
                hideLabel
                initialValue={product?.heroImage ?? ""}
              />
            </FormSection>
          </>
        }
      >
        {/* ---------- Main column: the product's own data ---------- */}
        <FormSection title="Identificação">
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField label="Nome" htmlFor="p-name" errors={state.errors?.name}>
              <input id="p-name" name="name" defaultValue={product?.name} required className={adminInputClass} />
            </AdminField>
            <AdminField label="Slug" htmlFor="p-slug" errors={state.errors?.slug}>
              <input id="p-slug" name="slug" defaultValue={product?.slug} required className={adminInputClass} />
            </AdminField>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
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
                value={categoryValue}
                onChange={(event) => setCategoryValue(event.target.value)}
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
                <option value={NEW_CATEGORY_VALUE}>+ Nova categoria…</option>
              </select>
            </AdminField>
          </div>

          {categoryValue === NEW_CATEGORY_VALUE && (
            <AdminField
              label="Nome da nova categoria"
              htmlFor="p-new-category"
              errors={state.errors?.newCategoryName}
              hint="Criada e atribuída a este produto ao guardar."
            >
              <input id="p-new-category" name="newCategoryName" autoFocus className={adminInputClass} />
            </AdminField>
          )}
        </FormSection>

        <FormSection title="Conteúdo">
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
        </FormSection>

        <FormSection title="Dados técnicos">
          <div className="grid gap-5 sm:grid-cols-3">
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
            hint="Uma por linha: Grupo | Etiqueta | Valor"
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
      </FormLayout>

      <FormActions
        error={state.message && !state.ok ? state.message : undefined}
        cancelHref="/admin/products"
        submitLabel="Guardar produto"
        pending={pending}
      />
    </form>
  );
}
