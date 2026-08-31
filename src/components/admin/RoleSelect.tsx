"use client";

import { useRef, useState } from "react";
import { changeUserRole } from "@/server/actions/team";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ROLE_LABELS, type RoleValue } from "@/lib/validation";

type Props = {
  userId: string;
  role: RoleValue;
  /** Disabled for the last admin and for your own row — the server enforces both. */
  disabled?: boolean;
  disabledTitle?: string;
};

/**
 * Role dropdown that submits on change. Demoting an admin is a meaningful
 * change, so it asks first and reverts the select if the user backs out.
 */
export function RoleSelect({ userId, role, disabled, disabledTitle }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [pedido, setPedido] = useState<RoleValue | null>(null);

  // Backing out has to put the select back where it was — the value changed the
  // moment the option was picked, before anyone confirmed anything.
  const reverter = () => {
    if (selectRef.current) selectRef.current.value = role;
    setPedido(null);
  };

  return (
    <form ref={formRef} action={changeUserRole}>
      <input type="hidden" name="id" value={userId} />
      <select
        ref={selectRef}
        name="role"
        defaultValue={role}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-label="Permissões"
        className="admin-input h-8 w-auto py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(event) => setPedido(event.target.value as RoleValue)}
      >
        <option value="COLABORADOR">Colaborador</option>
        <option value="EDITOR">Editor</option>
        <option value="GESTOR_RH">Gestor de RH</option>
        <option value="ADMIN">Administrador</option>
      </select>

      <ConfirmDialog
        open={pedido !== null}
        message={`Alterar as permissões deste utilizador para ${pedido ? (ROLE_LABELS[pedido] ?? pedido) : ""}?`}
        confirmLabel="Alterar permissões"
        onCancel={reverter}
        onConfirm={() => {
          setPedido(null);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
