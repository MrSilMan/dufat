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

/** Invite email. Plain-table HTML for the sake of legacy mail clients. */
export function inviteEmail(input: {
  name: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  expiresInDays: number;
}) {
  const { name, inviterName, roleLabel, url, expiresInDays } = input;

  const text = [
    `Olá ${name},`,
    ``,
    `${inviterName} convidou-o para a equipa Dufat, Lda. com o perfil de ${roleLabel}.`,
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
        <strong>${escapeHtml(inviterName)}</strong> convidou-o para a equipa de administração
        do site Dufat com o perfil de <strong>${escapeHtml(roleLabel)}</strong>.
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
