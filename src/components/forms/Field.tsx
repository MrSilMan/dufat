import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor: string;
  errors?: string[];
  children: ReactNode;
  optional?: boolean;
};

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-dufat-bright";

export function Field({ label, htmlFor, errors, children, optional }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 text-xs text-ink-faint">(opcional)</span>}
      </label>
      {children}
      {errors?.[0] && (
        <p role="alert" className="mt-1.5 text-xs text-lumen-deep">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
