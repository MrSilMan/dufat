"use client";

import { useActionState } from "react";
import { saveCaseStudy } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
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

type CaseStudyData = {
  id: string;
  title: string;
  slug: string;
  client: string;
  location: string;
  summary: string;
  body: string;
  heroImage: string | null;
  statsText: string;
  published: boolean;
  sortOrder: number;
};

export function CaseStudyForm({ study }: { study?: CaseStudyData }) {
  const [state, action, pending] = useActionState(saveCaseStudy, initialFormState);

  return (
    // Cancel React 19's automatic post-action form reset so a validation error
    // keeps every field the admin typed instead of silently reverting them.
    <form action={action} onReset={(event) => event.preventDefault()} noValidate>
      {study && <input type="hidden" name="id" value={study.id} />}

      <FormLayout
        /* ---------- Sidebar: how the case study is presented ---------- */
        aside={
          <>
            <FormSection title="Publicação">
              <SwitchGroup legend="Opções de publicação">
                <SwitchRow
                  name="published"
                  label="Publicado"
                  hint="Visível na lista de casos do site."
                  defaultChecked={study?.published ?? true}
                />
              </SwitchGroup>

              <AdminField
                label="Ordem"
                htmlFor="cs-order"
                errors={state.errors?.sortOrder}
                hint="Menor número aparece primeiro."
              >
                <input
                  id="cs-order"
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={study?.sortOrder ?? 0}
                  className={`${adminInputClass} w-24`}
                />
              </AdminField>
            </FormSection>

            <FormSection title="Imagem de fundo">
              <ImageUploadField
                name="heroImage"
                label="Imagem de fundo"
                hideLabel
                initialValue={study?.heroImage ?? ""}
                ratioClass="aspect-[16/9]"
              />
            </FormSection>
          </>
        }
      >
        {/* ---------- Main column: the case study's own data ---------- */}
        <FormSection title="Identificação">
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField label="Título" htmlFor="cs-title" errors={state.errors?.title}>
              <input id="cs-title" name="title" defaultValue={study?.title} required className={adminInputClass} />
            </AdminField>
            <AdminField label="Slug" htmlFor="cs-slug" errors={state.errors?.slug} hint="Usado no endereço da página.">
              <input id="cs-slug" name="slug" defaultValue={study?.slug} required className={adminInputClass} />
            </AdminField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField label="Cliente" htmlFor="cs-client" errors={state.errors?.client}>
              <input id="cs-client" name="client" defaultValue={study?.client} required className={adminInputClass} />
            </AdminField>
            <AdminField label="Localização" htmlFor="cs-location" errors={state.errors?.location}>
              <input
                id="cs-location"
                name="location"
                defaultValue={study?.location}
                required
                className={adminInputClass}
              />
            </AdminField>
          </div>
        </FormSection>

        <FormSection title="Conteúdo">
          <AdminField label="Resumo" htmlFor="cs-summary" errors={state.errors?.summary}>
            <textarea
              id="cs-summary"
              name="summary"
              rows={2}
              defaultValue={study?.summary}
              required
              className={adminInputClass}
            />
          </AdminField>

          <AdminField
            label="História"
            htmlFor="cs-body"
            errors={state.errors?.body}
            hint="Parágrafos separados por uma linha em branco."
          >
            <textarea
              id="cs-body"
              name="body"
              rows={8}
              defaultValue={study?.body}
              required
              className={adminInputClass}
            />
          </AdminField>
        </FormSection>

        <FormSection title="Resultados">
          <AdminField
            label="Estatísticas"
            htmlFor="cs-stats"
            errors={state.errors?.statsText}
            optional
            hint="Uma por linha: Etiqueta | Valor"
          >
            <textarea
              id="cs-stats"
              name="statsText"
              rows={4}
              defaultValue={study?.statsText}
              placeholder={"Pontos de luz | 1 200\nRedução de consumo | 58%"}
              className={`${adminInputClass} font-mono text-xs`}
            />
          </AdminField>
        </FormSection>
      </FormLayout>

      <FormActions
        error={state.message && !state.ok ? state.message : undefined}
        cancelHref="/admin/case-studies"
        submitLabel="Guardar caso de estudo"
        pending={pending}
      />
    </form>
  );
}
