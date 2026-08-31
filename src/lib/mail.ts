import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

/**
 * SMTP is optional. When it is not configured (or the send fails), the caller
 * falls back to showing the invite link in the admin UI, so inviting a
 * teammate never depends on mail infrastructure being up.
 */
const globalForMail = globalThis as unknown as { mailer?: Transporter | null };

function createTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host) return null;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587/25 upgrade via STARTTLS.
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    // Bounded on purpose. Sending is best-effort — the caller falls back to
    // showing the invite link — but without these a mail host that stalls
    // instead of refusing (throttling after failed logins, for instance) would
    // hang the admin form on the OS-default TCP timeout, which is minutes.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export const mailer = globalForMail.mailer ?? createTransport();
if (process.env.NODE_ENV !== "production") {
  globalForMail.mailer = mailer;
}

export function isMailConfigured(): boolean {
  return mailer !== null;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Sends an email. Returns a result rather than throwing, so callers can degrade. */
export async function sendMail({ to, subject, html, text }: SendInput): Promise<SendResult> {
  if (!mailer) return { ok: false, reason: "SMTP não configurado" };

  const from = process.env.SMTP_FROM ?? "Dufat, Lda. <no-reply@dufat.co.ao>";
  try {
    await mailer.sendMail({ from, to, subject, html, text });
    logger.info("mail_sent", { to, subject });
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error("mail_send_failed", { to, subject, message: reason });
    return { ok: false, reason };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Where inbound leads are announced. NOTIFY_EMAIL wins so the sales inbox can
 * differ from the address printed on the site; otherwise the public one is
 * used, since that is the address Dufat already publishes and monitors.
 */
export function leadInbox(): string {
  return process.env.NOTIFY_EMAIL?.trim() || "geral@dufat.co.ao";
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
}

/** Invite email. Plain-table HTML for the sake of legacy mail clients. */
export function inviteEmail(input: {
  name: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  expiresInDays: number;
  /** Employee invites describe the job, not a CMS profile. */
  colaborador?: boolean;
  cargoLabel?: string | null;
}) {
  const { name, inviterName, roleLabel, url, expiresInDays, colaborador, cargoLabel } = input;

  // An employee is not joining "the administration team of the website" — they
  // are being registered as staff, and the email should say what it actually is.
  const introTexto = colaborador
    ? `${inviterName} registou-o na equipa Dufat, Lda.${cargoLabel ? ` como ${cargoLabel}` : ""}.`
    : `${inviterName} convidou-o para a equipa Dufat, Lda. com o perfil de ${roleLabel}.`;

  const introHtml = colaborador
    ? `<strong>${escapeHtml(inviterName)}</strong> registou-o na equipa Dufat, Lda.${
        cargoLabel ? ` como <strong>${escapeHtml(cargoLabel)}</strong>` : ""
      }. Aqui vai registar a sua atividade e acompanhar a sua pontuação.`
    : `<strong>${escapeHtml(inviterName)}</strong> convidou-o para a equipa de administração
        do site Dufat com o perfil de <strong>${escapeHtml(roleLabel)}</strong>.`;

  const text = [
    `Olá ${name},`,
    ``,
    introTexto,
    ``,
    `Crie a sua password para activar a conta:`,
    url,
    ``,
    `O convite expira em ${expiresInDays} dias.`,
    `Se não estava à espera deste convite, ignore este email.`,
  ].join("\n");

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td style="font-size:20px;font-weight:bold;color:#114F8C;padding-bottom:8px;">Dufat, Lda.</td></tr>
      <tr><td style="font-size:16px;color:#1b2733;padding-bottom:16px;">Olá ${escapeHtml(name)},</td></tr>
      <tr><td style="font-size:15px;color:#42525f;line-height:1.6;padding-bottom:24px;">
        ${introHtml}
      </td></tr>
      <tr><td align="center" style="padding-bottom:24px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#114F8C;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;">
          Criar a minha password
        </a>
      </td></tr>
      <tr><td style="font-size:13px;color:#78889a;line-height:1.6;">
        Ou copie este endereço:<br>
        <span style="word-break:break-all;color:#114F8C;">${escapeHtml(url)}</span>
      </td></tr>
      <tr><td style="font-size:13px;color:#78889a;padding-top:24px;border-top:1px solid #e5eaef;margin-top:24px;">
        O convite expira em ${expiresInDays} dias. Se não estava à espera deste convite, ignore este email.
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject: "Convite para a equipa Dufat, Lda.", html, text };
}

// ---------------------------------------------------------------------------
// Lead notifications
//
// Two emails leave on every submission: one to Dufat so a lead is never left
// waiting on somebody opening the admin panel, and one to the sender so they
// hold a written record they can forward internally.
// ---------------------------------------------------------------------------

/** Branded outer table shared by every lead email. */
function shell(heading: string, body: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td style="font-size:20px;font-weight:bold;color:#114F8C;padding-bottom:4px;">Dufat, Lda.</td></tr>
      <tr><td style="font-size:17px;font-weight:bold;color:#1b2733;padding-bottom:20px;">${escapeHtml(heading)}</td></tr>
      ${body}
    </table>
  </td></tr>
</table>`.trim();
}

type Detail = { label: string; value: string; href?: string };

/** Label/value rows; a href turns the value into a tappable link. */
function detailRows(details: Detail[]): string {
  return details
    .filter((detail) => detail.value.trim().length > 0)
    .map((detail) => {
      const value = detail.href
        ? `<a href="${escapeHtml(detail.href)}" style="color:#114F8C;text-decoration:none;">${escapeHtml(detail.value)}</a>`
        : escapeHtml(detail.value);
      return `
      <tr>
        <td style="font-size:13px;color:#78889a;padding:6px 0;width:38%;vertical-align:top;">${escapeHtml(detail.label)}</td>
        <td style="font-size:15px;color:#1b2733;padding:6px 0;font-weight:600;">${value}</td>
      </tr>`;
    })
    .join("");
}

function messageBlock(message: string): string {
  return `
  <tr><td style="padding-top:20px;">
    <div style="font-size:13px;color:#78889a;padding-bottom:6px;">Mensagem</div>
    <div style="font-size:15px;color:#1b2733;line-height:1.6;background:#f4f6f8;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
  </td></tr>`;
}

function adminLink(path: string): string {
  const base = siteUrl();
  if (!base) return "";
  return `
  <tr><td align="center" style="padding-top:26px;">
    <a href="${escapeHtml(`${base}${path}`)}" style="display:inline-block;background:#114F8C;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:8px;font-size:15px;">
      Abrir no painel
    </a>
  </td></tr>`;
}

function textLines(lines: (string | false | null | undefined)[]): string {
  return lines.filter((line): line is string => typeof line === "string").join("\n");
}

/** Sent to Dufat when a B2B quote request arrives. */
export function quoteNotificationEmail(input: {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  productName?: string | null;
  quantity?: number | null;
  message: string;
}) {
  const { name, email, phone, company, productName, quantity, message } = input;
  const who = company ? `${name} (${company})` : name;

  const details: Detail[] = [
    { label: "Nome", value: name },
    { label: "Empresa / Instituição", value: company ?? "" },
    { label: "Email", value: email, href: `mailto:${email}` },
    { label: "Telefone", value: phone ?? "", href: phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : undefined },
    { label: "Produto", value: productName ?? "Vários / projeto completo" },
    { label: "Quantidade estimada", value: quantity ? String(quantity) : "" },
  ];

  const html = shell(
    "Novo pedido de orçamento",
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows(details)}</table></td></tr>
     ${messageBlock(message)}
     ${adminLink("/admin/quotes")}`,
  );

  const text = textLines([
    `Novo pedido de orçamento — ${who}`,
    ``,
    `Nome: ${name}`,
    company ? `Empresa: ${company}` : null,
    `Email: ${email}`,
    phone ? `Telefone: ${phone}` : null,
    `Produto: ${productName ?? "Vários / projeto completo"}`,
    quantity ? `Quantidade estimada: ${quantity}` : null,
    ``,
    `Mensagem:`,
    message,
  ]);

  return { subject: `Pedido de orçamento — ${who}`, html, text };
}

/** Sent to Dufat when a general contact message arrives. */
export function contactNotificationEmail(input: {
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
}) {
  const { name, email, phone, subject, message } = input;

  const details: Detail[] = [
    { label: "Nome", value: name },
    { label: "Email", value: email, href: `mailto:${email}` },
    { label: "Telefone", value: phone ?? "", href: phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : undefined },
    { label: "Assunto", value: subject },
  ];

  const html = shell(
    "Nova mensagem de contacto",
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows(details)}</table></td></tr>
     ${messageBlock(message)}
     ${adminLink("/admin")}`,
  );

  const text = textLines([
    `Nova mensagem de contacto — ${name}`,
    ``,
    `Nome: ${name}`,
    `Email: ${email}`,
    phone ? `Telefone: ${phone}` : null,
    `Assunto: ${subject}`,
    ``,
    `Mensagem:`,
    message,
  ]);

  return { subject: `Contacto — ${subject}`, html, text };
}

/**
 * Acknowledgement to whoever submitted. Restates what they sent so the email
 * itself is the record they can forward, and gives them a direct line in case
 * they need an answer sooner than the stated window.
 */
export function leadConfirmationEmail(input: {
  name: string;
  /** Restated back to the sender, verbatim. */
  message: string;
  kind: "quote" | "contact";
}) {
  const { name, message, kind } = input;
  const promise =
    kind === "quote"
      ? "Respondemos a pedidos de orçamento em 24–48 horas úteis."
      : "Respondemos normalmente no prazo de um dia útil.";
  const heading = kind === "quote" ? "Recebemos o seu pedido de orçamento" : "Recebemos a sua mensagem";

  const html = shell(
    heading,
    `<tr><td style="font-size:15px;color:#42525f;line-height:1.6;">
       Olá ${escapeHtml(name)}, obrigado pelo seu contacto. ${escapeHtml(promise)}
     </td></tr>
     ${messageBlock(message)}
     <tr><td style="font-size:14px;color:#42525f;line-height:1.7;padding-top:24px;border-top:1px solid #e5eaef;">
       Se precisar de resposta mais rápida:<br>
       Telefone <a href="tel:+244922293111" style="color:#114F8C;text-decoration:none;">+244 922 293 111</a><br>
       Email <a href="mailto:geral@dufat.co.ao" style="color:#114F8C;text-decoration:none;">geral@dufat.co.ao</a><br>
       Loja Kilamba Shopping, Edifício D3 — Loja 102, Luanda
     </td></tr>`,
  );

  const text = textLines([
    `Olá ${name},`,
    ``,
    `Obrigado pelo seu contacto. ${promise}`,
    ``,
    `O que nos enviou:`,
    message,
    ``,
    `Se precisar de resposta mais rápida:`,
    `Telefone: +244 922 293 111`,
    `Email: geral@dufat.co.ao`,
    `Loja: Kilamba Shopping, Edifício D3 — Loja 102, Luanda`,
    ``,
    `Dufat, Lda.`,
  ]);

  return { subject: `${heading} — Dufat, Lda.`, html, text };
}
