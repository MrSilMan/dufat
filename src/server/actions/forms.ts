"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
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
    if (result.data.productSlug) {
      const product = await prisma.product.findUnique({
        where: { slug: result.data.productSlug },
        select: { id: true },
      });
      productId = product?.id ?? null;
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
