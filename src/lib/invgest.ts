import "server-only";

/**
 * Minimal client for the INVGEST e-invoicing API (https://invgest.ao/api/v1).
 *
 * **Read-only.** We list catalog articles (to mirror them into admin products,
 * and to look them up while filling in a daily report), clients and issued
 * documents. We never POST: issuing a fiscal document consumes a series number
 * and is submitted to the AGT, which the API cannot undo (docs §6), and neither
 * creating clients nor creating articles is something a till report should do
 * behind the colaborador's back.
 *
 * Auth: `Authorization: Bearer <key>`. Errors follow `{ error: { code, message } }`.
 * See the INVGEST API documentation, sections 4 (endpoints) and 13 (errors).
 */

const BASE_FALLBACK = "https://invgest.ao/api/v1";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES_429 = 2;

/** The "Sync to INVGEST" action is available only when a key is configured. */
export function isInvgestEnabled(): boolean {
  return Boolean(process.env.INVGEST_API_KEY?.trim());
}

/** A typed INVGEST API error carrying the documented `code` (section 13). */
export class InvgestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InvgestError";
  }
}

type InvgestErrorBody = { error?: { code?: string; message?: string } };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  opts: {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const base = (process.env.INVGEST_API_URL?.trim() || BASE_FALLBACK).replace(/\/$/, "");
  const key = process.env.INVGEST_API_KEY?.trim();
  if (!key) throw new InvgestError(0, "not_configured", "INVGEST_API_KEY não está configurada.");

  const url = new URL(`${base}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // When routed via the Cloudflare Worker relay (ISP blackhole workaround),
      // the worker requires its own shared secret alongside the INVGEST key.
      const proxySecret = process.env.INVGEST_PROXY_SECRET?.trim();
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(proxySecret ? { "X-Proxy-Auth": proxySecret } : {}),
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      // Retry transient rate limits with progressive backoff (docs §12).
      if (res.status === 429 && attempt < MAX_RETRIES_429) {
        await sleep((attempt + 1) * 1000);
        continue;
      }

      const text = await res.text();
      const json = (text ? JSON.parse(text) : {}) as unknown;

      if (!res.ok) {
        const err = (json as InvgestErrorBody).error;
        throw new InvgestError(
          res.status,
          err?.code ?? "http_error",
          err?.message ?? `INVGEST respondeu ${res.status}.`,
        );
      }
      return json as T;
    } catch (error) {
      if (error instanceof InvgestError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new InvgestError(0, "timeout", "A ligação à INVGEST expirou.");
      }
      throw new InvgestError(0, "network_error", error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** A catalog article as returned by INVGEST. */
export type InvgestItem = {
  id: string;
  code?: string | null;
  description: string;
  unitPrice: number;
  taxRate: number;
  unit?: string | null;
  hasStock?: boolean;
  stockQuantity?: number | null;
};

/** List/search catalog articles (GET /items, scope items:read). */
export async function listItems(params: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: InvgestItem[]; total: number; hasMore: boolean }> {
  const res = await request<{
    data: InvgestItem[];
    pagination: { total: number; hasMore: boolean };
  }>("GET", "items", { query: params });
  return {
    items: res.data,
    total: res.pagination?.total ?? res.data.length,
    hasMore: res.pagination?.hasMore ?? false,
  };
}

/** A client (customer) as returned by INVGEST. */
export type InvgestClient = {
  id: string;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

/** List/search clients (GET /clients, scope clients:read). */
export async function listClients(
  params: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ clients: InvgestClient[]; total: number; hasMore: boolean }> {
  const res = await request<{
    data: InvgestClient[];
    pagination?: { total?: number; hasMore?: boolean };
  }>("GET", "clients", { query: params });
  return {
    clients: res.data ?? [],
    total: res.pagination?.total ?? res.data?.length ?? 0,
    hasMore: res.pagination?.hasMore ?? false,
  };
}

/**
 * One line of an issued document.
 *
 * `unitPrice` is net, as everywhere else in INVGEST; `net`, `tax` and `total`
 * are the line already added up, with the discount and the IVA applied. A till
 * report wants `total` — see {@link precoComIva}.
 */
export type InvgestInvoiceItem = {
  itemId?: string | null;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  taxRate?: number | null;
  net?: number | null;
  tax?: number | null;
  total?: number | null;
  unit?: string | null;
};

/**
 * An issued document. `status` and `agt.status` are documented in §8; what a
 * report cares about is the code, the client and the lines.
 */
export type InvgestInvoice = {
  id: string;
  code?: string | null;
  type?: string | null;
  status?: string | null;
  date?: string | null;
  client?: { id?: string | null; name?: string | null; taxId?: string | null } | null;
  totals?: { taxable?: number; tax?: number; total?: number } | null;
  items?: InvgestInvoiceItem[] | null;
};

/**
 * List issued documents (GET /invoices, scope invoices:read).
 *
 * INVGEST has no text search on this endpoint — only type/status/date filters
 * (§4) — so the picker asks for a recent window and narrows it here.
 */
export async function listInvoices(
  params: {
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<InvgestInvoice[]> {
  const res = await request<{ data: InvgestInvoice[] }>("GET", "invoices", { query: params });
  return res.data ?? [];
}

/** One document with its lines (GET /invoices/:id, scope invoices:read). */
export async function getInvoice(id: string): Promise<InvgestInvoice> {
  const res = await request<{ data: InvgestInvoice }>("GET", `invoices/${encodeURIComponent(id)}`);
  return res.data;
}

/**
 * Page through /items (100 per page), optionally narrowed by INVGEST's own
 * `search` filter and capped at `maxItems` — used for subset imports.
 */
export async function listAllItems(
  opts: { search?: string; maxItems?: number } = {},
): Promise<InvgestItem[]> {
  const maxItems = opts.maxItems ?? 5000;
  const all: InvgestItem[] = [];
  let offset = 0;
  while (all.length < maxItems) {
    const limit = Math.min(100, maxItems - all.length);
    const { items, hasMore } = await listItems({ search: opts.search, limit, offset });
    all.push(...items);
    if (!hasMore || items.length === 0) break;
    offset += items.length;
  }
  return all;
}

/**
 * A price as the customer pays it, in Kwanzas, from INVGEST's net one.
 *
 * Every price INVGEST returns — a catalog article's, a document line's — is net:
 * `unitPrice` excludes IVA and `taxRate` is the percentage added on top (14 is
 * the standard Angolan rate). What goes in the till, on a price tag or on a
 * daily report is the gross price, so prices coming out of the API pass through
 * here rather than being used as they arrive.
 */
export function precoComIva(unitPrice: number, taxRate?: number | null): number {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 0;
  const taxa = typeof taxRate === "number" && Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
  return Math.round(unitPrice * (100 + taxa)) / 100;
}

/** Map INVGEST error codes to friendly, admin-facing Portuguese messages. */
export function invgestErrorMessage(error: unknown): string {
  if (!(error instanceof InvgestError)) {
    return "Erro inesperado ao contactar a INVGEST.";
  }
  switch (error.code) {
    case "not_configured":
      return "A integração INVGEST não está configurada (falta a chave API).";
    case "missing_key":
    case "invalid_key":
      return "Chave INVGEST inválida ou revogada. Verifique a configuração.";
    case "insufficient_scope":
      return "A chave INVGEST não tem a permissão necessária para esta operação.";
    case "api_not_in_plan":
      return "O plano INVGEST não inclui acesso à API.";
    case "company_inactive":
      return "A conta INVGEST está inactiva ou suspensa.";
    case "validation_error":
      return `Dados recusados pela INVGEST: ${error.message}`;
    case "duplicate":
      return "Já existe um artigo com este código na INVGEST.";
    case "rate_limited":
    case "too_many_concurrent":
      return "Demasiados pedidos à INVGEST. Tente novamente daqui a instantes.";
    case "daily_quota_exceeded":
      return "Limite diário de criação de artigos na INVGEST atingido.";
    case "timeout":
    case "network_error":
      return "Não foi possível contactar a INVGEST. Tente novamente.";
    default:
      return error.message || "Erro ao sincronizar com a INVGEST.";
  }
}
