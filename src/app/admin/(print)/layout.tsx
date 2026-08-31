import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Bare shell for pages that exist to be printed.
 *
 * Deliberately outside the admin chrome: a sidebar and a nav bar are noise on
 * paper, and stripping them at print time with `display: none` leaves the page
 * laid out for a screen it will never be read on.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-shell">{children}</div>;
}
