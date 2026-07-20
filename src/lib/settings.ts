import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const SETTINGS_ID = "singleton";
export const SETTINGS_CACHE_KEY = "settings:site";
const CACHE_TTL = 300;

export type SiteSettings = {
  heroEyebrow: string;
  heroHeadline: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroScrollHint: string;

  logoUrl: string | null;
  faviconUrl: string | null;
  themeColor: string;

  footerTagline: string;
  footerNif: string;
  footerAddress: string;
  footerPhones: string[];
  footerEmail: string;
  footerCopyright: string;

  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;

  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  whatsappUrl: string | null;
};

/**
 * The shipped copy. Any field the admin has not set falls back to these, so an
 * empty database still renders the site exactly as designed.
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  heroEyebrow: "Dufat, Lda. · Iluminação pública LED · Angola",
  heroHeadline: "Iluminamos o futuro",
  heroHighlight: "de Angola",
  heroSubtitle:
    "Iluminação pública LED, postes galvanizados e material elétrico — explore o nosso candeeiro, peça a peça.",
  heroScrollHint: "Role para explorar",

  logoUrl: null,
  faviconUrl: null,
  themeColor: "#114F8C",

  footerTagline:
    "Comércio geral e prestação de serviços. Iluminamos o futuro das cidades de Angola com soluções LED eficientes e duradouras.",
  footerNif: "NIF 5002763494",
  footerAddress: "Av. Fidel de Castro — Kilamba\nShopping, Edifício D3 — Loja 102\nLuanda, Angola",
  footerPhones: ["+244 922 293 111", "+244 929 184 560"],
  footerEmail: "geral@dufat.co.ao",
  footerCopyright:
    "Dufat — Comércio Geral e Prestação de Serviços, Lda. Todos os direitos reservados.",

  seoTitle: "Dufat, Lda. — Iluminação Pública e Material Elétrico",
  seoDescription:
    "Iluminamos o futuro das cidades de Angola: luminárias públicas LED, postes galvanizados, iluminação decorativa e material elétrico profissional.",
  ogImageUrl: null,

  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  whatsappUrl: null,
};

/** Treats "" and null alike: an unset field always yields the default. */
function text(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type SettingsRow = {
  [K in keyof SiteSettings]?: SiteSettings[K] extends string[]
    ? string[]
    : string | null;
};

/** Merges a (possibly partial) DB row over the shipped defaults. */
export function mergeSettings(row: SettingsRow | null): SiteSettings {
  if (!row) return DEFAULT_SETTINGS;
  const phones = (row.footerPhones ?? []).map((p) => p.trim()).filter(Boolean);

  return {
    heroEyebrow: text(row.heroEyebrow, DEFAULT_SETTINGS.heroEyebrow),
    heroHeadline: text(row.heroHeadline, DEFAULT_SETTINGS.heroHeadline),
    // Unlike the others, an empty highlight is a legitimate choice (a headline
    // with no gradient tail), so only null — never "" — falls back.
    heroHighlight: row.heroHighlight === null || row.heroHighlight === undefined
      ? DEFAULT_SETTINGS.heroHighlight
      : row.heroHighlight.trim(),
    heroSubtitle: text(row.heroSubtitle, DEFAULT_SETTINGS.heroSubtitle),
    heroScrollHint: text(row.heroScrollHint, DEFAULT_SETTINGS.heroScrollHint),

    logoUrl: optional(row.logoUrl),
    faviconUrl: optional(row.faviconUrl),
    themeColor: text(row.themeColor, DEFAULT_SETTINGS.themeColor),

    footerTagline: text(row.footerTagline, DEFAULT_SETTINGS.footerTagline),
    footerNif: text(row.footerNif, DEFAULT_SETTINGS.footerNif),
    footerAddress: text(row.footerAddress, DEFAULT_SETTINGS.footerAddress),
    footerPhones: phones.length > 0 ? phones : DEFAULT_SETTINGS.footerPhones,
    footerEmail: text(row.footerEmail, DEFAULT_SETTINGS.footerEmail),
    footerCopyright: text(row.footerCopyright, DEFAULT_SETTINGS.footerCopyright),

    seoTitle: text(row.seoTitle, DEFAULT_SETTINGS.seoTitle),
    seoDescription: text(row.seoDescription, DEFAULT_SETTINGS.seoDescription),
    ogImageUrl: optional(row.ogImageUrl),

    facebookUrl: optional(row.facebookUrl),
    instagramUrl: optional(row.instagramUrl),
    linkedinUrl: optional(row.linkedinUrl),
    whatsappUrl: optional(row.whatsappUrl),
  };
}

/**
 * Site settings for rendering. Cached per-request (React `cache`) and across
 * requests (Redis). Never throws: a database outage degrades to the shipped
 * defaults rather than taking every page down with it.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    return await cached(SETTINGS_CACHE_KEY, CACHE_TTL, async () => {
      const row = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
      return mergeSettings(row);
    });
  } catch (error) {
    logger.warn("site_settings_load_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_SETTINGS;
  }
});
