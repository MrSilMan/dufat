"use client";

import { useActionState, useState } from "react";
import { saveSiteSettings } from "@/server/actions/admin";
import { initialFormState } from "@/lib/validation";
import { AdminField, FormSection, adminInputClass } from "@/components/admin/ui";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { SiteSettings } from "@/lib/settings";

type Props = {
  settings: SiteSettings;
  /** Shipped copy, shown as placeholders so admins see what "empty" renders. */
  defaults: SiteSettings;
  /** Editors don't get the brand section (logo/favicon/theme); admins do. */
  canEditBranding: boolean;
};

/** Mirrors the real hero: plain headline + gradient highlight. */
function HeadlinePreview({ headline, highlight }: { headline: string; highlight: string }) {
  return (
    <div className="rounded-xl bg-night px-5 py-6 text-center">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-a-faint">Pré-visualização</p>
      <p className="mt-2 font-display text-2xl font-black leading-tight text-white">
        {headline}{" "}
        <span className="bg-gradient-to-r from-dufat-sky to-lumen bg-clip-text text-transparent">
          {highlight}
        </span>
      </p>
    </div>
  );
}

export function SiteSettingsForm({ settings, defaults, canEditBranding }: Props) {
  const [state, action, pending] = useActionState(saveSiteSettings, initialFormState);
  const [headline, setHeadline] = useState(settings.heroHeadline);
  const [highlight, setHighlight] = useState(settings.heroHighlight);
  const [themeColor, setThemeColor] = useState(settings.themeColor);

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      <FormSection
        title="Herói"
        description="O texto sobreposto à cena 3D na página inicial. Deixe um campo vazio para repor o texto original."
      >
        <AdminField
          label="Texto de destaque"
          htmlFor="s-hero-eyebrow"
          errors={state.errors?.heroEyebrow}
          optional
          hint="A etiqueta pequena acima do título."
        >
          <input
            id="s-hero-eyebrow"
            name="heroEyebrow"
            defaultValue={settings.heroEyebrow}
            placeholder={defaults.heroEyebrow}
            className={adminInputClass}
          />
        </AdminField>

        <div className="grid gap-5 md:grid-cols-2">
          <AdminField label="Título" htmlFor="s-hero-headline" errors={state.errors?.heroHeadline}>
            <input
              id="s-hero-headline"
              name="heroHeadline"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder={defaults.heroHeadline}
              className={adminInputClass}
            />
          </AdminField>
          <AdminField
            label="Realce do título"
            htmlFor="s-hero-highlight"
            errors={state.errors?.heroHighlight}
            optional
            hint="Recebe o gradiente azul → âmbar."
          >
            <input
              id="s-hero-highlight"
              name="heroHighlight"
              value={highlight}
              onChange={(event) => setHighlight(event.target.value)}
              placeholder={defaults.heroHighlight}
              className={adminInputClass}
            />
          </AdminField>
        </div>

        {/* An empty headline falls back to the default, but an empty highlight
            is stored as-is — so the preview mirrors both rules exactly. */}
        <HeadlinePreview headline={headline.trim() || defaults.heroHeadline} highlight={highlight} />

        <AdminField label="Subtítulo" htmlFor="s-hero-subtitle" errors={state.errors?.heroSubtitle} optional>
          <textarea
            id="s-hero-subtitle"
            name="heroSubtitle"
            rows={2}
            defaultValue={settings.heroSubtitle}
            placeholder={defaults.heroSubtitle}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Dica de scroll"
          htmlFor="s-hero-scroll"
          errors={state.errors?.heroScrollHint}
          optional
        >
          <input
            id="s-hero-scroll"
            name="heroScrollHint"
            defaultValue={settings.heroScrollHint}
            placeholder={defaults.heroScrollHint}
            className={adminInputClass}
          />
        </AdminField>
      </FormSection>

      {canEditBranding && (
      <FormSection
        title="Marca"
        description="Logótipo, favicon e cor do tema. Sem logótipo carregado, é usada a marca Dufat original."
      >
        <ImageUploadField name="logoUrl" label="Logótipo" initialValue={settings.logoUrl ?? ""} />
        {state.errors?.logoUrl?.[0] && (
          <p role="alert" className="-mt-3 text-xs text-rose-500">
            {state.errors.logoUrl[0]}
          </p>
        )}

        <ImageUploadField name="faviconUrl" label="Favicon" initialValue={settings.faviconUrl ?? ""} />
        {state.errors?.faviconUrl?.[0] && (
          <p role="alert" className="-mt-3 text-xs text-rose-500">
            {state.errors.faviconUrl[0]}
          </p>
        )}

        <AdminField
          label="Cor do tema"
          htmlFor="s-theme-color"
          errors={state.errors?.themeColor}
          hint="Usada pelo navegador na barra de endereço em telemóveis."
        >
          <div className="flex items-center gap-3">
            <input
              id="s-theme-color"
              name="themeColor"
              value={themeColor}
              onChange={(event) => setThemeColor(event.target.value)}
              placeholder={defaults.themeColor}
              className={`${adminInputClass} font-mono`}
            />
            <span
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-lg border border-a-line"
              // Only paint a complete hex value; a half-typed "#11" is not a
              // valid colour and would render as transparent.
              style={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? { backgroundColor: themeColor } : undefined}
            />
          </div>
        </AdminField>
      </FormSection>
      )}

      <FormSection title="Rodapé" description="Descrição, contactos e aviso de direitos.">
        <AdminField label="Descrição" htmlFor="s-footer-tagline" errors={state.errors?.footerTagline} optional>
          <textarea
            id="s-footer-tagline"
            name="footerTagline"
            rows={3}
            defaultValue={settings.footerTagline}
            placeholder={defaults.footerTagline}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField label="NIF" htmlFor="s-footer-nif" errors={state.errors?.footerNif} optional>
          <input
            id="s-footer-nif"
            name="footerNif"
            defaultValue={settings.footerNif}
            placeholder={defaults.footerNif}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Morada"
          htmlFor="s-footer-address"
          errors={state.errors?.footerAddress}
          optional
          hint="Uma linha da morada por linha de texto."
        >
          <textarea
            id="s-footer-address"
            name="footerAddress"
            rows={3}
            defaultValue={settings.footerAddress}
            placeholder={defaults.footerAddress}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Telefones"
          htmlFor="s-footer-phones"
          errors={state.errors?.footerPhonesText}
          optional
          hint="Um número por linha (máx. 6)."
        >
          <textarea
            id="s-footer-phones"
            name="footerPhonesText"
            rows={2}
            defaultValue={settings.footerPhones.join("\n")}
            placeholder={defaults.footerPhones.join("\n")}
            className={`${adminInputClass} font-mono text-xs`}
          />
        </AdminField>

        <AdminField label="Email" htmlFor="s-footer-email" errors={state.errors?.footerEmail} optional>
          <input
            id="s-footer-email"
            name="footerEmail"
            type="email"
            defaultValue={settings.footerEmail}
            placeholder={defaults.footerEmail}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Aviso de direitos"
          htmlFor="s-footer-copyright"
          errors={state.errors?.footerCopyright}
          optional
          hint="O ano corrente é adicionado automaticamente."
        >
          <input
            id="s-footer-copyright"
            name="footerCopyright"
            defaultValue={settings.footerCopyright}
            placeholder={defaults.footerCopyright}
            className={adminInputClass}
          />
        </AdminField>
      </FormSection>

      <FormSection
        title="SEO"
        description="Como o site aparece no Google e ao ser partilhado nas redes sociais."
      >
        <AdminField
          label="Título"
          htmlFor="s-seo-title"
          errors={state.errors?.seoTitle}
          optional
          hint="Título da página inicial e base das restantes."
        >
          <input
            id="s-seo-title"
            name="seoTitle"
            defaultValue={settings.seoTitle}
            placeholder={defaults.seoTitle}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField label="Descrição" htmlFor="s-seo-description" errors={state.errors?.seoDescription} optional>
          <textarea
            id="s-seo-description"
            name="seoDescription"
            rows={3}
            defaultValue={settings.seoDescription}
            placeholder={defaults.seoDescription}
            className={adminInputClass}
          />
        </AdminField>

        <ImageUploadField
          name="ogImageUrl"
          label="Imagem de partilha (Open Graph)"
          initialValue={settings.ogImageUrl ?? ""}
        />
        {state.errors?.ogImageUrl?.[0] && (
          <p role="alert" className="-mt-3 text-xs text-rose-500">
            {state.errors.ogImageUrl[0]}
          </p>
        )}
      </FormSection>

      <FormSection
        title="Redes sociais"
        description="Ligações mostradas no rodapé. Deixe vazio para esconder."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminField label="Facebook" htmlFor="s-facebook" errors={state.errors?.facebookUrl} optional>
            <input
              id="s-facebook"
              name="facebookUrl"
              defaultValue={settings.facebookUrl ?? ""}
              placeholder="https://facebook.com/…"
              className={adminInputClass}
            />
          </AdminField>
          <AdminField label="Instagram" htmlFor="s-instagram" errors={state.errors?.instagramUrl} optional>
            <input
              id="s-instagram"
              name="instagramUrl"
              defaultValue={settings.instagramUrl ?? ""}
              placeholder="https://instagram.com/…"
              className={adminInputClass}
            />
          </AdminField>
          <AdminField label="LinkedIn" htmlFor="s-linkedin" errors={state.errors?.linkedinUrl} optional>
            <input
              id="s-linkedin"
              name="linkedinUrl"
              defaultValue={settings.linkedinUrl ?? ""}
              placeholder="https://linkedin.com/company/…"
              className={adminInputClass}
            />
          </AdminField>
          <AdminField label="WhatsApp" htmlFor="s-whatsapp" errors={state.errors?.whatsappUrl} optional>
            <input
              id="s-whatsapp"
              name="whatsappUrl"
              defaultValue={settings.whatsappUrl ?? ""}
              placeholder="https://wa.me/244…"
              className={adminInputClass}
            />
          </AdminField>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-emerald-500" : "text-rose-500"}`}
        >
          {state.message ?? ""}
        </p>
        <button type="submit" disabled={pending} className="btn-admin px-8 py-3">
          {pending ? "A guardar…" : "Guardar definições"}
        </button>
      </div>
    </form>
  );
}
