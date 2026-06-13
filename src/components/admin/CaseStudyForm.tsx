"use client";

import { useActionState } from "react";
import { saveCaseStudy } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { Field, inputClass } from "@/components/forms/Field";
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

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Título" htmlFor="cs-title" errors={state.errors?.title}>
          <input id="cs-title" name="title" defaultValue={study?.title} required className={inputClass} />
        </Field>
        <Field label="Slug" htmlFor="cs-slug" errors={state.errors?.slug}>
          <input id="cs-slug" name="slug" defaultValue={study?.slug} required className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Cliente" htmlFor="cs-client" errors={state.errors?.client}>
          <input id="cs-client" name="client" defaultValue={study?.client} required className={inputClass} />
        </Field>
        <Field label="Localização" htmlFor="cs-location" errors={state.errors?.location}>
          <input id="cs-location" name="location" defaultValue={study?.location} required className={inputClass} />
        </Field>
      </div>

      <Field label="Resumo" htmlFor="cs-summary" errors={state.errors?.summary}>
        <textarea id="cs-summary" name="summary" rows={2} defaultValue={study?.summary} required className={inputClass} />
      </Field>

      <Field label="História (parágrafos separados por linha em branco)" htmlFor="cs-body" errors={state.errors?.body}>
        <textarea id="cs-body" name="body" rows={8} defaultValue={study?.body} required className={inputClass} />
      </Field>

      <ImageUploadField name="heroImage" label="Imagem de fundo" initialValue={study?.heroImage ?? ""} />

      <Field
        label="Estatísticas (uma por linha: Etiqueta | Valor)"
        htmlFor="cs-stats"
        errors={state.errors?.statsText}
        optional
      >
        <textarea
          id="cs-stats"
          name="statsText"
          rows={4}
          defaultValue={study?.statsText}
          placeholder={"Pontos de luz | 1 200\nRedução de consumo | 58%"}
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            name="published"
            defaultChecked={study?.published ?? true}
            className="h-4 w-4 accent-dufat"
          />
          Publicado
        </label>
        <Field label="Ordem" htmlFor="cs-order" errors={state.errors?.sortOrder}>
          <input
            id="cs-order"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={study?.sortOrder ?? 0}
            className={`${inputClass} w-24`}
          />
        </Field>
      </div>

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
        {pending ? "A guardar…" : "Guardar caso de estudo"}
      </button>
    </form>
  );
}
