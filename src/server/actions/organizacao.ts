"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { assertGestaoRH } from "@/lib/auth";
import {
  alternarAtivoSchema,
  cargoSchema,
  categoriaAtividadeSchema,
  departamentoSchema,
  type FormState,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/** Accent-stripped, URL-safe slug — matches how the catalogue builds its own. */
function slugify(input: string, fallback: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

/**
 * A slug that does not collide with an existing row of the same kind.
 *
 * Two departments called "Comercial" and "Comercial Norte" must not fight over
 * one slug, and renaming must not silently steal another row's.
 */
async function slugLivre(
  base: string,
  existe: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await existe(base))) return base;
  for (let n = 2; n < 50; n += 1) {
    const candidato = `${base}-${n}`;
    if (!(await existe(candidato))) return candidato;
  }
  return `${base}-${Date.now()}`;
}

function revalidar() {
  revalidatePath("/admin/organizacao");
  // The pickers on these screens are populated from the same tables.
  revalidatePath("/admin/colaboradores");
  revalidatePath("/admin/team");
  revalidatePath("/equipa");
}

// ---------- Cargos ----------

export async function guardarCargo(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await assertGestaoRH();

  const result = cargoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, nome, diasSemana } = result.data;

  if (id) {
    const anterior = await prisma.cargo.findUnique({ where: { id }, select: { nome: true } });
    if (!anterior) return { ok: false, message: "Cargo não encontrado." };

    await prisma.cargo.update({ where: { id }, data: { nome, diasSemana } });
    await recordAudit(actor, {
      action: "organizacao.cargo_atualizado",
      entity: "Cargo",
      entityId: id,
      summary: `Atualizou o cargo "${anterior.nome}" → "${nome}" (${diasSemana} dias/semana)`,
    });
    revalidar();
    return { ok: true, message: `Cargo "${nome}" atualizado.` };
  }

  const slug = await slugLivre(slugify(nome, "cargo"), async (candidato) =>
    Boolean(
      await prisma.cargo.findUnique({ where: { slug: candidato }, select: { id: true } }),
    ),
  );

  const criado = await prisma.cargo.create({ data: { nome, slug, diasSemana } });
  await recordAudit(actor, {
    action: "organizacao.cargo_criado",
    entity: "Cargo",
    entityId: criado.id,
    summary: `Criou o cargo "${nome}" (${diasSemana} dias/semana)`,
  });
  revalidar();
  return { ok: true, message: `Cargo "${nome}" criado.` };
}

// ---------- Departamentos ----------

export async function guardarDepartamento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await assertGestaoRH();

  const result = departamentoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);
  const { id, nome } = result.data;

  if (id) {
    const anterior = await prisma.departamento.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!anterior) return { ok: false, message: "Departamento não encontrado." };

    await prisma.departamento.update({ where: { id }, data: { nome } });
    await recordAudit(actor, {
      action: "organizacao.departamento_atualizado",
      entity: "Departamento",
      entityId: id,
      summary: `Atualizou o departamento "${anterior.nome}" → "${nome}"`,
    });
    revalidar();
    return { ok: true, message: `Departamento "${nome}" atualizado.` };
  }

  const slug = await slugLivre(slugify(nome, "departamento"), async (candidato) =>
    Boolean(
      await prisma.departamento.findUnique({ where: { slug: candidato }, select: { id: true } }),
    ),
  );
  const ordem = await prisma.departamento.aggregate({ _max: { sortOrder: true } });

  const criado = await prisma.departamento.create({
    data: { nome, slug, sortOrder: (ordem._max.sortOrder ?? -1) + 1 },
  });
  await recordAudit(actor, {
    action: "organizacao.departamento_criado",
    entity: "Departamento",
    entityId: criado.id,
    summary: `Criou o departamento "${nome}"`,
  });
  revalidar();
  return { ok: true, message: `Departamento "${nome}" criado.` };
}

// ---------- Categorias de atividade ----------

export async function guardarCategoriaAtividade(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await assertGestaoRH();

  const result = categoriaAtividadeSchema.safeParse({
    ...Object.fromEntries(formData),
    isOutro: formData.get("isOutro") === "on",
  });
  if (!result.success) return validationError(result.error);
  const { id, nome, isOutro } = result.data;

  if (id) {
    const anterior = await prisma.categoriaAtividade.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!anterior) return { ok: false, message: "Categoria não encontrada." };

    await prisma.categoriaAtividade.update({ where: { id }, data: { nome, isOutro } });
    await recordAudit(actor, {
      action: "organizacao.categoria_atualizada",
      entity: "CategoriaAtividade",
      entityId: id,
      summary: `Atualizou a categoria "${anterior.nome}" → "${nome}"${isOutro ? ' (conta como "Outro")' : ""}`,
    });
    revalidar();
    return { ok: true, message: `Categoria "${nome}" atualizada.` };
  }

  const slug = await slugLivre(slugify(nome, "categoria"), async (candidato) =>
    Boolean(
      await prisma.categoriaAtividade.findUnique({ where: { slug: candidato }, select: { id: true } }),
    ),
  );
  const ordem = await prisma.categoriaAtividade.aggregate({ _max: { sortOrder: true } });

  const criada = await prisma.categoriaAtividade.create({
    data: { nome, slug, isOutro, sortOrder: (ordem._max.sortOrder ?? -1) + 1 },
  });
  await recordAudit(actor, {
    action: "organizacao.categoria_criada",
    entity: "CategoriaAtividade",
    entityId: criada.id,
    summary: `Criou a categoria de atividade "${nome}"${isOutro ? ' (conta como "Outro")' : ""}`,
  });
  revalidar();
  return { ok: true, message: `Categoria "${nome}" criada.` };
}

// ---------- Activate / deactivate ----------

/**
 * Retires or restores one entry.
 *
 * Deactivation rather than deletion: a cargo that has been used is part of how
 * past periods were scored, and deleting it would break the record of who was
 * compared against whom.
 */
export async function alternarAtivo(formData: FormData): Promise<void> {
  const actor = await assertGestaoRH();

  const result = alternarAtivoSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  const { id, tipo, ativo } = result.data;

  if (tipo === "cargo") {
    const cargo = await prisma.cargo.findUnique({
      where: { id },
      select: { nome: true, _count: { select: { users: true } } },
    });
    if (!cargo) return;
    // Leaving people attached to a retired cargo would drop them out of the
    // ranking with no explanation on any screen.
    if (!ativo && cargo._count.users > 0) return;

    await prisma.cargo.update({ where: { id }, data: { ativo } });
    await recordAudit(actor, {
      action: ativo ? "organizacao.cargo_atualizado" : "organizacao.cargo_desativado",
      entity: "Cargo",
      entityId: id,
      summary: `${ativo ? "Reativou" : "Desativou"} o cargo "${cargo.nome}"`,
    });
  } else if (tipo === "departamento") {
    const departamento = await prisma.departamento.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!departamento) return;
    await prisma.departamento.update({ where: { id }, data: { ativo } });
    await recordAudit(actor, {
      action: ativo
        ? "organizacao.departamento_atualizado"
        : "organizacao.departamento_desativado",
      entity: "Departamento",
      entityId: id,
      summary: `${ativo ? "Reativou" : "Desativou"} o departamento "${departamento.nome}"`,
    });
  } else {
    const categoria = await prisma.categoriaAtividade.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!categoria) return;
    await prisma.categoriaAtividade.update({ where: { id }, data: { ativo } });
    await recordAudit(actor, {
      action: ativo ? "organizacao.categoria_atualizada" : "organizacao.categoria_desativada",
      entity: "CategoriaAtividade",
      entityId: id,
      summary: `${ativo ? "Reativou" : "Desativou"} a categoria "${categoria.nome}"`,
    });
  }

  revalidar();
}
