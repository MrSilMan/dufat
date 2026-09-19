import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MAX_TAXA_IVA } from "@/lib/relatorios/dinheiro";
import {
  getInvoice,
  isInvgestEnabled,
  listClients,
  listInvoices,
  listItems,
  precoComIva,
  InvgestError,
  type InvgestInvoice,
  type InvgestInvoiceItem,
} from "@/lib/invgest";

/**
 * Lookups that fill a report in: articles, clients and issued documents.
 *
 * Articles come from two places. The local `Product` table is the INVGEST
 * catalog as it was last imported — it answers instantly, works when INVGEST
 * is unreachable, and is what the admin has already curated. The live catalog
 * is then merged in, so an article created in INVGEST this morning is findable
 * before anyone runs an import. Matches are deduplicated by INVGEST item id.
 *
 * Every call here is read-only (see {@link file://../invgest.ts}) and cached
 * for a few seconds: a colaborador typing a name would otherwise spend the
 * key's 120 reads/minute (docs §12) on the same query eight times.
 */

const TTL_MS = 30_000;
const MAX_ENTRADAS = 200;

type Entrada = { valor: unknown; expira: number };
const cache = new Map<string, Entrada>();

/** Also serves as a single-flight: concurrent identical searches share a call. */
const emCurso = new Map<string, Promise<unknown>>();

async function cachear<T>(chave: string, producer: () => Promise<T>): Promise<T> {
  const agora = Date.now();
  const entrada = cache.get(chave);
  if (entrada && entrada.expira > agora) return entrada.valor as T;

  const jaEmCurso = emCurso.get(chave);
  if (jaEmCurso) return jaEmCurso as Promise<T>;

  const promessa = producer()
    .then((valor) => {
      if (cache.size >= MAX_ENTRADAS) {
        // Cheap eviction: the oldest insertion is the first key Map yields.
        const maisAntiga = cache.keys().next();
        if (!maisAntiga.done) cache.delete(maisAntiga.value);
      }
      cache.set(chave, { valor, expira: Date.now() + TTL_MS });
      return valor;
    })
    .finally(() => emCurso.delete(chave));

  emCurso.set(chave, promessa);
  return promessa;
}

/** A Kwanza amount from INVGEST (85000 = 85 000,00 Kz) as cêntimos. */
function kwanzasParaCentimos(valor: number | null | undefined): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return 0;
  return Math.round(valor * 100);
}

/** `Decimal(12,2)` Kwanzas as cêntimos, via the string so no float is involved. */
function decimalParaCentimos(valor: { toFixed(casas: number): string } | null): number {
  if (!valor) return 0;
  const [inteiro = "0", decimal = "00"] = valor.toFixed(2).split(".");
  const centimos = Number(inteiro) * 100 + Number(decimal);
  return Number.isSafeInteger(centimos) && centimos > 0 ? centimos : 0;
}

// ---------- Articles ----------

export type ArtigoEncontrado = {
  /** Unique within a result list, and the key the picker sends back. */
  chave: string;
  descricao: string;
  codigo: string | null;
  /**
   * Cêntimos with IVA, as the customer pays it — or 0 when the catalog has no
   * price ("preço sob consulta").
   */
  precoCentimos: number;
  unidade: string | null;
  invgestItemId: string | null;
  /** Where this match was found — shown as a badge, so nobody has to guess. */
  origem: "invgest" | "local";
};

export type ResultadoPesquisa<T> = {
  resultados: T[];
  /** Set when the live INVGEST half of the search could not be reached. */
  aviso?: string;
};

const LIMITE = 8;

/** Local products whose name, SKU or INVGEST code matches. */
async function artigosLocais(termo: string): Promise<ArtigoEncontrado[]> {
  const produtos = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: termo, mode: "insensitive" } },
        { sku: { contains: termo, mode: "insensitive" } },
        { modelCode: { contains: termo, mode: "insensitive" } },
        { invgestItemCode: { contains: termo, mode: "insensitive" } },
      ],
    },
    orderBy: [{ invgestSyncedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: LIMITE,
    select: {
      id: true,
      name: true,
      sku: true,
      priceKz: true,
      invgestItemId: true,
      invgestItemCode: true,
    },
  });

  return produtos.map((produto) => ({
    chave: produto.invgestItemId ?? `local:${produto.id}`,
    descricao: produto.name,
    codigo: produto.invgestItemCode ?? produto.sku,
    precoCentimos: decimalParaCentimos(produto.priceKz),
    unidade: null,
    invgestItemId: produto.invgestItemId,
    origem: produto.invgestItemId ? "invgest" : "local",
  }));
}

/**
 * Articles matching what was typed: the imported catalog first, then anything
 * INVGEST knows about that the last import did not bring in.
 *
 * A live catalog that is down is not an error here — the local half of the
 * answer still stands, with a note saying the rest could not be reached.
 */
export async function procurarArtigos(termo: string): Promise<ResultadoPesquisa<ArtigoEncontrado>> {
  const procura = termo.trim();
  if (procura.length < 2) return { resultados: [] };

  return cachear(`artigos:${procura.toLowerCase()}`, async () => {
    const locais = await artigosLocais(procura);
    if (!isInvgestEnabled()) return { resultados: locais };

    const vistos = new Set(locais.map((artigo) => artigo.invgestItemId).filter(Boolean));
    try {
      const { items } = await listItems({ search: procura, limit: LIMITE * 2 });
      const remotos = items
        .filter((item) => !vistos.has(item.id))
        .slice(0, LIMITE)
        .map<ArtigoEncontrado>((item) => ({
          chave: item.id,
          descricao: item.description,
          codigo: item.code ?? null,
          precoCentimos: kwanzasParaCentimos(precoComIva(item.unitPrice, item.taxRate)),
          unidade: item.unit ?? null,
          invgestItemId: item.id,
          origem: "invgest",
        }));
      return { resultados: [...locais, ...remotos].slice(0, LIMITE * 2) };
    } catch (error) {
      registarFalha("artigos", error);
      return {
        resultados: locais,
        aviso: locais.length
          ? "Só foram procurados os artigos já importados — a INVGEST não respondeu."
          : "Não foi possível procurar na INVGEST. Escreva a descrição à mão.",
      };
    }
  });
}

// ---------- Clients ----------

export type ClienteEncontrado = {
  invgestId: string;
  nome: string;
  nif: string | null;
};

/** Clients matching what was typed. Empty (with a note) when INVGEST is off. */
export async function procurarClientes(
  termo: string,
): Promise<ResultadoPesquisa<ClienteEncontrado>> {
  const procura = termo.trim();
  if (procura.length < 2) return { resultados: [] };
  if (!isInvgestEnabled()) {
    return { resultados: [], aviso: "A procura de clientes precisa da ligação à INVGEST." };
  }

  return cachear(`clientes:${procura.toLowerCase()}`, async () => {
    try {
      const { clients } = await listClients({ search: procura, limit: LIMITE });
      return {
        resultados: clients.map<ClienteEncontrado>((cliente) => ({
          invgestId: cliente.id,
          nome: cliente.name,
          nif: cliente.taxId ?? null,
        })),
      };
    } catch (error) {
      registarFalha("clientes", error);
      return {
        resultados: [],
        aviso: "Não foi possível procurar clientes na INVGEST. Escreva o nome à mão.",
      };
    }
  });
}

// ---------- Issued documents ----------

export type FacturaEncontrada = {
  invgestId: string;
  codigo: string;
  clienteNome: string | null;
  clienteNif: string | null;
  data: string | null;
  /** The document's own total, IVA included — what the picker lists. */
  totalCentimos: number;
  numLinhas: number;
};

/**
 * How far back the picker looks for a document to copy, and how many it takes.
 *
 * The cap is what actually binds: INVGEST returns newest first, so this is the
 * 100 most recent documents within the window — at Dufat's rate that is the
 * last week or two, which is the horizon a daily till report works in. Anything
 * older is typed in by hand, and the picker says so rather than appearing to
 * search everything.
 */
const DIAS_FACTURAS = 60;
const LIMITE_FACTURAS = 100;

function comoFacturaEncontrada(factura: InvgestInvoice): FacturaEncontrada {
  return {
    invgestId: factura.id,
    codigo: factura.code ?? factura.id,
    clienteNome: factura.client?.name ?? null,
    clienteNif: factura.client?.taxId ?? null,
    data: factura.date ?? null,
    totalCentimos: kwanzasParaCentimos(factura.totals?.total),
    numLinhas: factura.items?.length ?? 0,
  };
}

/**
 * Recent INVGEST documents, narrowed by what was typed.
 *
 * The endpoint filters by type, status and date but not by text (§4), so one
 * recent window is fetched (and cached) and the matching is done here against
 * the document code and the client's name — which is what someone holding the
 * printed document actually has to hand.
 */
export async function procurarFacturas(
  termo: string,
): Promise<ResultadoPesquisa<FacturaEncontrada>> {
  if (!isInvgestEnabled()) {
    return { resultados: [], aviso: "A procura de facturas precisa da ligação à INVGEST." };
  }

  const janela = new Date();
  janela.setUTCDate(janela.getUTCDate() - DIAS_FACTURAS);
  const dateFrom = janela.toISOString().slice(0, 10);

  const recentes = await cachear(`facturas:${dateFrom}`, async () => {
    try {
      const facturas = await listInvoices({ dateFrom, limit: LIMITE_FACTURAS });
      return { resultados: facturas.map(comoFacturaEncontrada) };
    } catch (error) {
      registarFalha("facturas", error);
      return {
        resultados: [] as FacturaEncontrada[],
        aviso: "Não foi possível obter as facturas da INVGEST.",
      };
    }
  });

  const procura = termo.trim().toLowerCase();
  if (!procura) return { ...recentes, resultados: recentes.resultados.slice(0, LIMITE) };

  const corresponde = (factura: FacturaEncontrada) =>
    factura.codigo.toLowerCase().includes(procura) ||
    (factura.clienteNome ?? "").toLowerCase().includes(procura) ||
    (factura.clienteNif ?? "").includes(procura);

  return { ...recentes, resultados: recentes.resultados.filter(corresponde).slice(0, LIMITE) };
}

export type LinhaDeFactura = {
  descricao: string;
  /** Thousandths of a unit, as the editor holds quantities. */
  quantidadeMil: number;
  /** Taxable — see {@link precoUnitarioTributavel}. */
  precoUnitarioCentimos: number;
  /** Hundredths of a percent (1400 = 14%), added on top of the line's total. */
  taxaIvaCentesimos: number;
  artigoInvgestId: string | null;
  artigoCodigo: string | null;
};

export type FacturaCarregada = {
  invgestId: string;
  codigo: string;
  clienteNome: string | null;
  clienteNif: string | null;
  clienteInvgestId: string | null;
  linhas: LinhaDeFactura[];
};

/** One document with its lines, ready to become a record. */
export async function carregarFactura(id: string): Promise<FacturaCarregada | null> {
  if (!isInvgestEnabled()) return null;

  return cachear(`factura:${id}`, async () => {
    const factura = await getInvoice(id);
    return {
      invgestId: factura.id,
      codigo: factura.code ?? factura.id,
      clienteNome: factura.client?.name ?? null,
      clienteNif: factura.client?.taxId ?? null,
      clienteInvgestId: factura.client?.id ?? null,
      linhas: (factura.items ?? []).map<LinhaDeFactura>((item) => {
        const quantidadeMil = quantidadeParaMil(item.quantity);
        return {
          descricao: item.description,
          quantidadeMil,
          precoUnitarioCentimos: precoUnitarioTributavel(item, quantidadeMil),
          taxaIvaCentesimos: taxaParaCentesimos(item.taxRate),
          artigoInvgestId: item.itemId ?? null,
          artigoCodigo: item.itemCode ?? null,
        };
      }),
    };
  });
}

/**
 * The taxable price of one unit, in cêntimos — what the document says.
 *
 * Kept taxable, with the rate carried alongside, because that is the only way
 * the record can land on the document's own total: INVGEST rounds the IVA once
 * per line, so 10 × 3 508,77 is 35 087,70 + 4 912,28 = 39 999,98, a figure no
 * gross unit price multiplies back to. The editor adds the IVA the same way.
 *
 * A discounted line is the exception. INVGEST's `net` is already the discount
 * applied, and there is nowhere in a quantity × price line to put the discount
 * itself, so the unit price becomes the discounted one — which can round by a
 * cêntimo when the discount does not divide evenly.
 */
function precoUnitarioTributavel(item: InvgestInvoiceItem, quantidadeMil: number): number {
  const comDesconto = typeof item.discountPercent === "number" && item.discountPercent > 0;
  const liquidoCentimos = kwanzasParaCentimos(item.net);
  if (comDesconto && liquidoCentimos > 0 && quantidadeMil > 0) {
    return Math.round((liquidoCentimos * 1000) / quantidadeMil);
  }
  return kwanzasParaCentimos(item.unitPrice);
}

/** A line's IVA rate in hundredths of a percent, as the editor holds it. */
function taxaParaCentesimos(taxRate: number | null | undefined): number {
  if (typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate <= 0) return 0;
  return Math.min(Math.round(taxRate * 100), MAX_TAXA_IVA);
}

/** INVGEST quantities are plain numbers; the editor holds thousandths. */
function quantidadeParaMil(quantidade: number | null | undefined): number {
  if (typeof quantidade !== "number" || !Number.isFinite(quantidade) || quantidade <= 0) {
    return 1000;
  }
  return Math.min(Math.round(quantidade * 1000), 999_999_000);
}

function registarFalha(o_que: string, error: unknown): void {
  logger.warn("invgest_pesquisa_falhou", {
    o_que,
    code: error instanceof InvgestError ? error.code : "desconhecido",
    message: error instanceof Error ? error.message : String(error),
  });
}
