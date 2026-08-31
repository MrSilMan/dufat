"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import {
  contactNotificationEmail,
  isMailConfigured,
  leadConfirmationEmail,
  leadInbox,
  quoteNotificationEmail,
  sendMail,
} from "@/lib/mail";
import {
  contactSchema,
  newsletterSchema,
  quoteSchema,
  type FormState,
} from "@/lib/validation";

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * Announces a lead to Dufat and acknowledges it to the sender.
 *
 * Runs after the response via `after()` so a slow or unreachable SMTP server
 * never delays the "recebido" the visitor is waiting on, and never fails the
 * submission — the row is already committed, and `sendMail` reports rather
 * than throws. When SMTP is unconfigured this logs loudly instead: a lead that
 * only reaches the database is a lead nobody has been told about.
 */
function dispatchLead(input: {
  kind: "quote" | "contact";
  id: string;
  senderName: string;
  senderEmail: string;
  /** The lead's own words, restated in the acknowledgement. */
  message: string;
  notification: { subject: string; html: string; text: string };
}) {
  const { kind, id, senderName, senderEmail, message, notification } = input;

  if (!isMailConfigured()) {
    logger.warn("lead_notification_skipped_smtp_unconfigured", {
      kind,
      id,
      email: senderEmail,
      hint: "Set SMTP_HOST to notify the sales inbox.",
    });
    return;
  }

  after(async () => {
    const inbox = leadInbox();
    const toDufat = await sendMail({ to: inbox, ...notification });
    if (!toDufat.ok) {
      logger.error("lead_notification_failed", { kind, id, to: inbox, reason: toDufat.reason });
    }

    // Best-effort courtesy: a failed acknowledgement must not be treated as a
    // failed lead, so it is logged at warn and nothing else.
    const ack = leadConfirmationEmail({ name: senderName, message, kind });
    const toSender = await sendMail({ to: senderEmail, ...ack });
    if (!toSender.ok) {
      logger.warn("lead_confirmation_failed", { kind, id, to: senderEmail, reason: toSender.reason });
    }
  });
}

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`contact:${ip}`, 5, 600))) {
    return { ok: false, message: "Demasiados pedidos. Tente novamente em alguns minutos." };
  }

  const result = contactSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);

  try {
    const submission = await prisma.contactSubmission.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone || null,
        subject: result.data.subject,
        message: result.data.message,
      },
    });
    logger.info("contact_submission_received", {
      id: submission.id,
      email: submission.email,
      subject: submission.subject,
    });
    dispatchLead({
      kind: "contact",
      id: submission.id,
      senderName: submission.name,
      senderEmail: submission.email,
      message: submission.message,
      notification: contactNotificationEmail({
        name: submission.name,
        email: submission.email,
        phone: submission.phone,
        subject: submission.subject,
        message: submission.message,
      }),
    });
    return { ok: true, message: "Mensagem enviada. Entraremos em contacto em breve." };
  } catch (error) {
    logger.error("contact_submission_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Não foi possível enviar. Tente novamente." };
  }
}

export async function submitQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`quote:${ip}`, 5, 600))) {
    return { ok: false, message: "Demasiados pedidos. Tente novamente em alguns minutos." };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  if (raw.quantity === "") delete raw.quantity;
  const result = quoteSchema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  try {
    let productId: string | null = null;
    // The name travels into the notification so the sales inbox reads the
    // product rather than a slug.
    let productName: string | null = null;
    if (result.data.productSlug) {
      const product = await prisma.product.findUnique({
        where: { slug: result.data.productSlug },
        select: { id: true, name: true },
      });
      productId = product?.id ?? null;
      productName = product?.name ?? null;
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone || null,
        company: result.data.company || null,
        message: result.data.message,
        quantity: result.data.quantity ?? null,
        productId,
      },
    });
    logger.info("quote_request_received", {
      id: quote.id,
      email: quote.email,
      productId,
      quantity: quote.quantity,
    });
    dispatchLead({
      kind: "quote",
      id: quote.id,
      senderName: quote.name,
      senderEmail: quote.email,
      message: quote.message,
      notification: quoteNotificationEmail({
        name: quote.name,
        email: quote.email,
        phone: quote.phone,
        company: quote.company,
        productName,
        quantity: quote.quantity,
        message: quote.message,
      }),
    });
    return { ok: true, message: "Pedido de orçamento recebido. Responderemos em 24–48h úteis." };
  } catch (error) {
    logger.error("quote_request_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Não foi possível enviar. Tente novamente." };
  }
}

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`newsletter:${ip}`, 3, 600))) {
    return { ok: false, message: "Demasiados pedidos. Tente novamente em alguns minutos." };
  }

  const result = newsletterSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email: result.data.email },
      update: {},
      create: { email: result.data.email },
    });
    logger.info("newsletter_subscribed", { email: result.data.email });
    return { ok: true, message: "Subscrição confirmada. Obrigado!" };
  } catch (error) {
    logger.error("newsletter_subscription_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Não foi possível subscrever. Tente novamente." };
  }
}
