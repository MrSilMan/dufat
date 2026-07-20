import { cn } from "@/lib/cn";

type Props = {
  /**
   * "light" renders white-on-transparent (for dark backgrounds), "dark"
   * blue-on-transparent, and "themed" reads --a-logo-main / --a-logo-inverse so
   * the mark follows the admin light/dark theme.
   */
  variant?: "light" | "dark" | "themed";
  className?: string;
  /**
   * Admin-uploaded logo (site settings). When set it replaces the built-in
   * wordmark; `variant` no longer applies since the image carries its own
   * colours. Falls back to the vector mark when null/empty.
   */
  logoUrl?: string | null;
  /** Accessible name for the uploaded logo; defaults to the company name. */
  alt?: string;
};

/**
 * Vector reproduction of the Dufat, Lda. wordmark: a large "D" monogram,
 * "UFAT" inside a solid block, and the small "LDA." mark.
 */
export function DufatLogo({ variant = "light", className, logoUrl, alt }: Props) {
  if (logoUrl) {
    return (
      // Arbitrary admin upload (incl. SVG) with unknown intrinsic size, so
      // next/image cannot size it; height stays CSS-driven.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={alt ?? "Dufat, Lda."}
        className={cn("h-9 w-auto object-contain", className)}
      />
    );
  }

  const main =
    variant === "themed" ? "var(--a-logo-main)" : variant === "light" ? "#FFFFFF" : "#114F8C";
  const inverse =
    variant === "themed" ? "var(--a-logo-inverse)" : variant === "light" ? "#114F8C" : "#FFFFFF";

  return (
    <svg
      viewBox="0 0 300 100"
      role="img"
      aria-label="Dufat, Lda."
      className={cn("h-9 w-auto", className)}
    >
      <text
        x="0"
        y="82"
        fontFamily="var(--font-outfit), Arial Black, sans-serif"
        fontWeight="900"
        fontSize="96"
        fill={main}
      >
        D
      </text>
      <rect x="78" y="26" width="178" height="50" fill={main} />
      <text
        x="167"
        y="64"
        textAnchor="middle"
        fontFamily="var(--font-outfit), Arial Black, sans-serif"
        fontWeight="800"
        fontSize="40"
        letterSpacing="6"
        fill={inverse}
      >
        UFAT
      </text>
      <text
        x="262"
        y="76"
        fontFamily="var(--font-outfit), Arial, sans-serif"
        fontWeight="700"
        fontSize="15"
        fill={main}
      >
        LDA.
      </text>
    </svg>
  );
}
