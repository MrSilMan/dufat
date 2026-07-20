"use client";

import { useRef } from "react";
import { changeUserRole } from "@/server/actions/team";

type Props = {
  userId: string;
  role: "ADMIN" | "EDITOR";
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

  return (
    <form ref={formRef} action={changeUserRole}>
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-label="Permissões"
        className="admin-input h-8 w-auto py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(event) => {
          const next = event.target.value;
          const label = next === "ADMIN" ? "Administrador" : "Editor";
          if (window.confirm(`Alterar as permissões deste utilizador para ${label}?`)) {
            formRef.current?.requestSubmit();
          } else {
            event.target.value = role;
          }
        }}
      >
        <option value="EDITOR">Editor</option>
        <option value="ADMIN">Administrador</option>
      </select>
    </form>
  );
}
