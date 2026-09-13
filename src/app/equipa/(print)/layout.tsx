import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Bare shell for employee-area documents meant for paper or PDF — the same
 * bargain as the admin's `(print)` group: no header, no tab bar.
 */
export default function EquipaPrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-shell">{children}</div>;
}
