import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  calcularLinha,
  MAX_DESCONTO_PERCENTAGEM,
  MAX_TAXA_IVA,
  type Desconto,
} from "@/lib/relatorios/dinheiro";
import {
  getInvoice,
  isInvgestEnabled,
  listClients,
  listAllInvoices,
  listAllItems,
  precoComIva,
  InvgestError,
  type InvgestInvoice,
  type InvgestInvoiceItem,
  type InvgestItem,
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
 * key's 120 reads/minute (docs §12) on the same query eight times. The live
 * catalog is held for a few minutes — see {@link catalogoInvgest}.
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
  /**
   * The rate that price already contains, in hundredths of a percent. INVGEST
   * states each article's; a locally imported one does not keep it, so it is
   * assumed standard — the price is right either way, only the base/IVA split
   * would be, and the editor's toggle settles it.
   */
  taxaIvaCentesimos: number;
  unidade: string | null;
  invgestItemId: string | null;
  /** Where this match was found — shown as a badge, so nobody has to guess. */
  origem: "invgest" | "local";
};

export type ResultadoPesquisa<T> = {
  resultados: T[];
  /** Set when the live INVGEST half of the search could not be reached, or was cut short. */
  aviso?: string;
};

const LIMITE = 8;

/** Lower case with the accents taken off, so "lampada" finds "Lâmpada". */
function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The typed words, each of which must match — in any order. */
function palavrasDe(termo: string): string[] {
  return termo.split(/\s+/).filter(Boolean);
}

/**
 * The accented letters Portuguese uses and what they fold to. The database has
 * no `unaccent`, so `translate` does it — both strings must stay the same length.
 */
const COM_ACENTO = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç";
const SEM_ACENTO = "AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc";

/** Local products where every typed word is in the name, SKU or a code. */
async function artigosLocais(termo: string): Promise<ArtigoEncontrado[]> {
  const condicoes = palavrasDe(semAcentos(termo)).map(
    (palavra) =>
      Prisma.sql`translate(concat_ws(' ', p.name, p.sku, p."modelCode", p."invgestItemCode"), ${COM_ACENTO}, ${SEM_ACENTO}) ILIKE ${`%${palavra.replace(/[\\%_]/g, "\\$&")}%`}`,
  );
  const encontrados = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Product" p
    WHERE ${Prisma.join(condicoes, " AND ")}
    ORDER BY p."invgestSyncedAt" DESC NULLS LAST, p.name ASC
    LIMIT ${LIMITE}
  `;
  if (encontrados.length === 0) return [];

  const produtos = await prisma.product.findMany({
    where: { id: { in: encontrados.map((produto) => produto.id) } },
    orderBy: [{ invgestSyncedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
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
    taxaIvaCentesimos: TAXA_NORMAL,
    unidade: null,
    invgestItemId: produto.invgestItemId,
    origem: produto.invgestItemId ? "invgest" : "local",
  }));
}

/**
 * The whole INVGEST catalog, searched here rather than by INVGEST.
 *
 * INVGEST's own `search` matches what was typed as one phrase, accents and all:
 * "hibrido" does not find "Híbrido", nor "parede foco" "Foco De Parede". So the
 * catalog — about 1300 articles, 330 KB, fourteen calls, a second and a half —
 * is fetched whole and kept on the server. Only the matches go to the browser.
 *
 * Fresh for two minutes. Up to ten, a search is answered from the copy in hand
 * while a new one is fetched behind it, so only the first search after a quiet
 * spell waits; past that it waits rather than offer a stale price.
 */
const CATALOGO_FRESCO_MS = 2 * 60_000;
const CATALOGO_VALIDO_MS = 10 * 60_000;

/** `texto` and `codigo` are {@link semAcentos}'d once, not on every keystroke. */
type ArtigoDoCatalogo = { item: InvgestItem; texto: string; codigo: string };
let catalogo: { artigos: ArtigoDoCatalogo[]; em: number } | null = null;
let catalogoACarregar: Promise<ArtigoDoCatalogo[]> | null = null;

function carregarCatalogo(): Promise<ArtigoDoCatalogo[]> {
  catalogoACarregar ??= listAllItems()
    .then((items) => {
      const artigos = items.map((item) => ({
        item,
        texto: semAcentos(`${item.description} ${item.code ?? ""}`),
        codigo: semAcentos(item.code ?? ""),
      }));
      catalogo = { artigos, em: Date.now() };
      return artigos;
    })
    .finally(() => {
      catalogoACarregar = null;
    });
  return catalogoACarregar;
}

async function catalogoInvgest(): Promise<ArtigoDoCatalogo[]> {
  const idade = catalogo ? Date.now() - catalogo.em : Infinity;
  if (catalogo && idade < CATALOGO_FRESCO_MS) return catalogo.artigos;
  if (catalogo && idade < CATALOGO_VALIDO_MS) {
    const jaEmCurso = catalogoACarregar !== null;
    const recarga = carregarCatalogo();
    if (!jaEmCurso) recarga.catch((error) => registarFalha("catalogo", error));
    return catalogo.artigos;
  }
  return carregarCatalogo();
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
    const palavras = palavrasDe(semAcentos(procura));
    // A code typed in full goes first, then names that start with the first
    // word; the rest keep INVGEST's order.
    const ordem = ({ texto, codigo }: ArtigoDoCatalogo) =>
      codigo === palavras.join(" ") ? 0 : texto.startsWith(palavras[0]!) ? 1 : 2;
    try {
      const remotos = (await catalogoInvgest())
        .filter(
          (artigo) =>
            !vistos.has(artigo.item.id) &&
            palavras.every((palavra) => artigo.texto.includes(palavra)),
        )
        .sort((a, b) => ordem(a) - ordem(b))
        .slice(0, LIMITE)
        .map<ArtigoEncontrado>(({ item }) => ({
          chave: item.id,
          descricao: item.description,
          codigo: item.code ?? null,
          precoCentimos: kwanzasParaCentimos(precoComIva(item.unitPrice, item.taxRate)),
          taxaIvaCentesimos: taxaParaCentesimos(item.taxRate),
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
 * How far back the picker looks for a document to copy.
 *
 * The whole window is read, every page of it. It used to be the first page
 * only — the 100 newest documents — and at Dufat's rate, two in three of them
 * pro-formas, that reached back barely a week: an invoice from two weeks ago
 * was in INVGEST but not in the picker. The window is about 400 documents,
 * four calls, cached with everything else here. The ceiling is a guard against
 * a runaway window, not a limit that should bind; the picker says so if it
 * does. The panel (`ImportarFactura`) names the window, so change both.
 */
const DIAS_FACTURAS = 60;
const MAX_FACTURAS = 1000;

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
      const facturas = await listAllInvoices({ dateFrom, maxInvoices: MAX_FACTURAS });
      return {
        resultados: facturas.map(comoFacturaEncontrada),
        aviso:
          facturas.length >= MAX_FACTURAS
            ? `Só aparecem os ${MAX_FACTURAS} documentos mais recentes.`
            : undefined,
      };
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
  /** Taxable, before the line's discount — see {@link precoEDesconto}. */
  precoUnitarioCentimos: number;
  /** The document's own discount on the line; null when it gave none. */
  desconto: Desconto | null;
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
          ...precoEDesconto(item, quantidadeMil),
          taxaIvaCentesimos: taxaParaCentesimos(item.taxRate),
          artigoInvgestId: item.itemId ?? null,
          artigoCodigo: item.itemCode ?? null,
        };
      }),
    };
  });
}

/**
 * The taxable price of one unit, in cêntimos, and the discount the document
 * gave on the line — what the document says, both of them.
 *
 * Kept taxable, with the rate carried alongside, because that is the only way
 * the record can land on the document's own total: INVGEST rounds the IVA once
 * per line, so 10 × 3 508,77 is 35 087,70 + 4 912,28 = 39 999,98, a figure no
 * gross unit price multiplies back to. The editor adds the IVA the same way.
 *
 * INVGEST states a discount as a percentage, and `net` as what the line came to
 * with it. The percentage is kept when it lands on that `net` exactly; where
 * INVGEST rounded differently, the discount becomes the amount it took off, so
 * the record still adds up to the document to the cêntimo.
 */
function precoEDesconto(
  item: InvgestInvoiceItem,
  quantidadeMil: number,
): { precoUnitarioCentimos: number; desconto: Desconto | null } {
  const precoUnitarioCentimos = kwanzasParaCentimos(item.unitPrice);
  const liquido = kwanzasParaCentimos(item.net);

  if (precoUnitarioCentimos <= 0) {
    // No price to discount from: what the line came to is all there is.
    return {
      precoUnitarioCentimos:
        liquido > 0 && quantidadeMil > 0 ? Math.round((liquido * 1000) / quantidadeMil) : 0,
      desconto: null,
    };
  }

  const percentagem = item.discountPercent;
  if (typeof percentagem !== "number" || !Number.isFinite(percentagem) || percentagem <= 0) {
    return { precoUnitarioCentimos, desconto: null };
  }

  const semImposto = (desconto: Desconto | null) =>
    calcularLinha({
      quantidadeMil,
      precoUnitarioCentimos,
      taxaIvaCentesimos: 0,
      precoIncluiIva: false,
      desconto,
    }).total;
  const emPercentagem: Desconto = {
    tipo: "PERCENTAGEM",
    centesimos: Math.min(Math.round(percentagem * 100), MAX_DESCONTO_PERCENTAGEM),
  };
  if (liquido <= 0 || semImposto(emPercentagem) === liquido) {
    return { precoUnitarioCentimos, desconto: emPercentagem };
  }

  const bruto = semImposto(null);
  return {
    precoUnitarioCentimos,
    desconto: liquido < bruto ? { tipo: "VALOR", centimos: bruto - liquido } : null,
  };
}

/** 14% — the standard Angolan rate, assumed where the catalog does not say. */
const TAXA_NORMAL = 1400;

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
