import { unsyncProductFromInvgest } from "@/server/actions/admin";
import { DangerSubmit } from "@/components/admin/DangerSubmit";

const DETACH_CONFIRM =
  "Desassociar este produto da INVGEST?\n\nO produto permanece no site — deixa apenas de ser atualizado nas próximas importações. O artigo na INVGEST não é afetado.";

const badgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600";

/**
 * Read-only "where did this product come from" indicator, used on the products
 * table and the edit page. Imported products show an INVGEST badge (+ item code)
 * and, for ADMINs, a local-only "Desassociar" (detach). Local products show a dash.
 */
export function InvgestOrigin({
  productId,
  imported,
  itemCode,
  canDetach,
  detailed = false,
}: {
  productId: string;
  imported: boolean;
  itemCode: string | null;
  canDetach: boolean;
  detailed?: boolean;
}) {
  if (!imported) {
    return (
      <span className="text-sm text-a-faint">
        {detailed ? "Produto local (não importado da INVGEST)" : "—"}
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${detailed ? "items-start" : "items-end"}`}>
      <span className={badgeClass}>
        <span aria-hidden>✓</span>
        INVGEST{itemCode ? ` · ${itemCode}` : ""}
      </span>
      {canDetach ? (
        <form action={unsyncProductFromInvgest}>
          <input type="hidden" name="id" value={productId} />
          <DangerSubmit
            confirmMessage={DETACH_CONFIRM}
            className="text-xs text-a-faint underline-offset-2 transition-colors hover:text-rose-500 hover:underline"
          >
            Desassociar
          </DangerSubmit>
        </form>
      ) : null}
    </div>
  );
}
