/**
 * WhatsApp is the working B2B channel in Angola, so the site treats it as a
 * primary call to action rather than a social link. The admin stores one value
 * (`SiteSettings.whatsappUrl`) which may be either a wa.me/api URL or a bare
 * phone number; everything here normalises that into a link that opens a chat
 * with the message already typed.
 */

/** Digits only, as wa.me expects: no +, spaces or punctuation. */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Turns whatever the admin saved into a wa.me base URL, or null when it cannot
 * be read as one. Accepts "+244 922 293 111", "244922293111",
 * "wa.me/244922293111" and "https://api.whatsapp.com/send?phone=244922293111".
 */
export function whatsappBase(setting: string | null | undefined): string | null {
  const raw = setting?.trim();
  if (!raw) return null;

  // A bare number (possibly formatted) — no scheme, no host.
  if (!/[a-z]/i.test(raw)) {
    const number = digits(raw);
    return number ? `https://wa.me/${number}` : null;
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  // api.whatsapp.com/send?phone=… and web.whatsapp.com/send?phone=…
  const phoneParam = url.searchParams.get("phone");
  if (phoneParam) {
    const number = digits(phoneParam);
    return number ? `https://wa.me/${number}` : null;
  }

  // wa.me/<number>
  const fromPath = digits(url.pathname);
  if (fromPath) return `https://wa.me/${fromPath}`;

  return null;
}

/**
 * A chat link with `message` pre-typed. The visitor sends it with one tap and
 * Dufat receives the context — which product, which page — without anyone
 * having to ask.
 */
export function whatsappLink(
  setting: string | null | undefined,
  message?: string,
): string | null {
  const base = whatsappBase(setting);
  if (!base) return null;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Opening line for the general (non-product) button. */
export const WHATSAPP_GENERAL_MESSAGE = "Olá Dufat, gostaria de mais informações.";

/** Opening line naming the product the visitor is looking at. */
export function whatsappProductMessage(productName: string): string {
  return `Olá Dufat, tenho interesse em: ${productName}.`;
}
