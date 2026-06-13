import Link from "next/link";
import { prisma } from "@/lib/db";
import { deleteCaseStudy } from "@/server/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminCaseStudiesPage() {
  const studies = await prisma.caseStudy.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Casos de Estudo</h1>
        <Link
          href="/admin/case-studies/new"
          className="rounded-full bg-dufat px-5 py-2.5 text-sm font-semibold text-white hover:bg-dufat-bright"
        >
          + Novo caso
        </Link>
      </div>

      <div className="card-night mt-8 divide-y divide-night-line">
        {studies.length === 0 && <p className="p-6 text-sm text-white/50">Ainda sem casos de estudo.</p>}
        {studies.map((study) => (
          <div key={study.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{study.title}</p>
              <p className="text-xs text-white/45">
                {study.location} · {study.client}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                study.published ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/50"
              }`}
            >
              {study.published ? "Publicado" : "Rascunho"}
            </span>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/case-studies/${study.id}/edit`} className="text-dufat-sky hover:underline">
                Editar
              </Link>
              <form action={deleteCaseStudy}>
                <input type="hidden" name="id" value={study.id} />
                <button type="submit" className="text-red-400/80 hover:underline">
                  Apagar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
