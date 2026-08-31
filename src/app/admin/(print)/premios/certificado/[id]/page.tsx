import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { parsePeriodo, rotuloPeriodo } from "@/lib/award/periodo";
import { BotaoImprimir } from "@/components/premios/BotaoImprimir";

export const metadata: Metadata = { title: "Certificado", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The "Funcionário do Mês" certificate, laid out as a single A4 page.
 *
 * Rendered as HTML with `@page { size: A4 }` and printed by the browser rather
 * than composed by a PDF library: it keeps the DUFAT palette and web fonts
 * exactly as the rest of the admin uses them, and adds no dependency for one
 * page a month.
 */
export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireGestaoRH();
  const { id } = await params;

  const [period, settings] = await Promise.all([
    prisma.awardPeriod.findUnique({
      where: { id },
      select: {
        id: true,
        periodo: true,
        tipo: true,
        estado: true,
        pontuacaoVencedor: true,
        confirmadoEm: true,
        confirmadoPor: { select: { name: true } },
        departamento: { select: { nome: true } },
        vencedor: {
          select: {
            name: true,
            photoUrl: true,
            cargo: { select: { nome: true } },
            departamento: { select: { nome: true } },
          },
        },
      },
    }),
    getSiteSettings(),
  ]);

  if (!period || !period.vencedor) notFound();

  // A certificate for an unconfirmed period would be a document asserting
  // something nobody has decided yet.
  if (period.estado !== "CONFIRMADO") {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Período por confirmar</h1>
        <p className="mt-3 text-sm text-ink-soft">
          O certificado só é gerado depois de o Administrador confirmar o vencedor de{" "}
          {rotuloPeriodo(period.periodo)}.
        </p>
      </main>
    );
  }

  const anual = period.tipo === "ANUAL";
  const { ano } = anual
    ? { ano: Number(period.periodo) }
    : parsePeriodo(period.periodo);
  const titulo = anual ? "Funcionário do Ano" : "Funcionário do Mês";

  return (
    <>
      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-6 py-4">
        <p className="text-sm text-ink-soft">
          Certificado de {period.vencedor.name} — {rotuloPeriodo(period.periodo)}
        </p>
        <BotaoImprimir label="Guardar como PDF" />
      </div>

      <main className="certificado">
        <div className="certificado-moldura">
          <header className="certificado-topo">
            {settings.logoUrl ? (
              /* Printed at a fixed physical size from an arbitrary upload. */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="DUFAT" className="certificado-logo" />
            ) : (
              <p className="certificado-marca">DUFAT</p>
            )}
            <p className="certificado-nif">
              {settings.footerTagline ?? "Iluminação pública e soluções elétricas"}
            </p>
          </header>

          <p className="certificado-eyebrow">Certificado de Reconhecimento</p>
          <h1 className="certificado-titulo">{titulo}</h1>

          {period.vencedor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={period.vencedor.photoUrl}
              alt=""
              className="certificado-foto"
            />
          ) : (
            <div className="certificado-foto certificado-foto-vazia" aria-hidden />
          )}

          <p className="certificado-atribuido">é atribuído a</p>
          <p className="certificado-nome">{period.vencedor.name}</p>
          <p className="certificado-cargo">
            {period.vencedor.cargo?.nome ?? ""}
            {period.vencedor.departamento ? ` · ${period.vencedor.departamento.nome}` : ""}
          </p>

          <p className="certificado-periodo">
            {anual ? ano : rotuloPeriodo(period.periodo)}
          </p>

          <p className="certificado-corpo">
            Pelo desempenho, consistência e qualidade do trabalho registado
            {period.departamento ? ` no departamento de ${period.departamento.nome}` : ""}, com
            uma pontuação de {Number(period.pontuacaoVencedor ?? 0).toFixed(1)} em 100.
          </p>

          <footer className="certificado-rodape">
            <div>
              <div className="certificado-linha" />
              <p className="certificado-assinatura">{period.confirmadoPor?.name ?? "Administração"}</p>
              <p className="certificado-funcao">Administração — DUFAT, Lda.</p>
            </div>
            <div>
              <div className="certificado-linha" />
              <p className="certificado-assinatura">
                {period.confirmadoEm
                  ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(
                      period.confirmadoEm,
                    )
                  : "—"}
              </p>
              <p className="certificado-funcao">Data de atribuição</p>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
