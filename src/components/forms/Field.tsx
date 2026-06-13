import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor: string;
  errors?: string[];
  children: ReactNode;
  optional?: boolean;
};

export const inputClass =
  "w-full rounded-xl border border-night-line bg-night-soft px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-dufat-sky";

export function Field({ label, htmlFor, errors, children, optional }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
        {optional && <span className="ml-1 text-xs text-white/40">(opcional)</span>}
      </label>
      {children}
      {errors?.[0] && (
        <p role="alert" className="mt-1.5 text-xs text-amber-400">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
