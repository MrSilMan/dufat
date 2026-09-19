"use server";

import { requireSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { invgestErrorMessage } from "@/lib/invgest";
import { acessoRelatorios } from "@/lib/relatorios/acesso";
import {
  carregarFactura,
  procurarArtigos,
  procurarClientes,
  procurarFacturas,
  type ArtigoEncontrado,
  type ClienteEncontrado,
  type FacturaCarregada,
  type FacturaEncontrada,
  type ResultadoPesquisa,
} from "@/lib/relatorios/catalogo";
import { pesquisaCatalogoSchema } from "@/lib/validation";

/**
 * The lookups behind the report editor's pickers: articles, clients and issued
 * documents, all read from INVGEST (and the imported catalog).
 *
 * They are separate from `actions/relatorios.ts` because they write nothing —
 * but they still check that the caller may keep reports, so an account without
 * that grant cannot use the site as a window onto the company's client list.
 *
 * Every one of them degrades rather than throws: a picker that cannot reach
 * INVGEST says so and lets the colaborador type the name, which is how the
 * reports worked before the pickers existed.
 */

const VAZIO = { resultados: [] };

async function podeProcurar(): Promise<boolean> {
  const session = await requireSession("/equipa/entrar");
  return (await acessoRelatorios(session)).registar;
}

function falhou(o_que: string, error: unknown): ResultadoPesquisa<never> {
  logger.error("relatorio_pesquisa_falhou", {
    o_que,
    message: error instanceof Error ? error.message : String(error),
  });
  return { resultados: [], aviso: invgestErrorMessage(error) };
}

export async function pesquisarArtigos(
  termo: string,
): Promise<ResultadoPesquisa<ArtigoEncontrado>> {
  if (!(await podeProcurar())) return VAZIO;
  const result = pesquisaCatalogoSchema.safeParse({ termo });
  if (!result.success) return VAZIO;

  try {
    return await procurarArtigos(result.data.termo);
  } catch (error) {
    return falhou("artigos", error);
  }
}

export async function pesquisarClientes(
  termo: string,
): Promise<ResultadoPesquisa<ClienteEncontrado>> {
  if (!(await podeProcurar())) return VAZIO;
  const result = pesquisaCatalogoSchema.safeParse({ termo });
  if (!result.success) return VAZIO;

  try {
    return await procurarClientes(result.data.termo);
  } catch (error) {
    return falhou("clientes", error);
  }
}

export async function pesquisarFacturas(
  termo: string,
): Promise<ResultadoPesquisa<FacturaEncontrada>> {
  if (!(await podeProcurar())) return VAZIO;
  const result = pesquisaCatalogoSchema.safeParse({ termo });
  if (!result.success) return VAZIO;

  try {
    return await procurarFacturas(result.data.termo);
  } catch (error) {
    return falhou("facturas", error);
  }
}

export type ResultadoFactura =
  | { ok: true; factura: FacturaCarregada }
  | { ok: false; message: string };

/** One document with its lines, to fill a record in. Reads only. */
export async function obterFactura(id: string): Promise<ResultadoFactura> {
  if (!(await podeProcurar())) {
    return { ok: false, message: "Sem acesso." };
  }
  if (!id || id.length > 64) return { ok: false, message: "Documento inválido." };

  try {
    const factura = await carregarFactura(id);
    if (!factura) {
      return { ok: false, message: "A integração INVGEST não está configurada." };
    }
    if (factura.linhas.length === 0) {
      return { ok: false, message: "Este documento não tem linhas para importar." };
    }
    return { ok: true, factura };
  } catch (error) {
    logger.error("relatorio_factura_falhou", {
      id,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: invgestErrorMessage(error) };
  }
}
