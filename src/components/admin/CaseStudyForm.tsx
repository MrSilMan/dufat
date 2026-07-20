"use client";

import { useActionState } from "react";
import { saveCaseStudy } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";
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
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      {study && <input type="hidden" name="id" value={study.id} />}

      <FormSection title="Identificação" description="Título público, endereço e contexto do projeto.">
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField label="Título" htmlFor="cs-title" errors={state.errors?.title}>
            <input id="cs-title" name="title" defaultValue={study?.title} required className={adminInputClass} />
          </AdminField>
          <AdminField label="Slug" htmlFor="cs-slug" errors={state.errors?.slug} hint="Usado no endereço da página.">
            <input id="cs-slug" name="slug" defaultValue={study?.slug} required className={adminInputClass} />
          </AdminField>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
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

      <FormSection title="Conteúdo" description="A narrativa e a imagem que ilustram o projeto.">
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
          <textarea id="cs-body" name="body" rows={8} defaultValue={study?.body} required className={adminInputClass} />
        </AdminField>

        <ImageUploadField name="heroImage" label="Imagem de fundo" initialValue={study?.heroImage ?? ""} />

        <AdminField
          label="Estatísticas"
          htmlFor="cs-stats"
          errors={state.errors?.statsText}
          optional
          hint="Uma por linha, no formato: Etiqueta | Valor"
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

      <FormSection title="Publicação" description="Visibilidade e posição na lista de casos.">
        <div className="flex flex-wrap items-end gap-6">
          <label className="toggle-pill">
            <input
              type="checkbox"
              name="published"
              defaultChecked={study?.published ?? true}
              className="h-4 w-4 accent-dufat-bright"
            />
            Publicado
          </label>
          <AdminField label="Ordem" htmlFor="cs-order" errors={state.errors?.sortOrder}>
            <input
              id="cs-order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={study?.sortOrder ?? 0}
              className={`${adminInputClass} w-24`}
            />
          </AdminField>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p role="alert" className="text-sm text-rose-500">
          {state.message && !state.ok ? state.message : ""}
        </p>
        <button type="submit" disabled={pending} className="btn-admin px-8 py-3">
          {pending ? "A guardar…" : "Guardar caso de estudo"}
        </button>
      </div>
    </form>
  );
}
