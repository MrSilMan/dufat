import { cn } from "@/lib/cn";

type Props = {
  /** "light" renders white-on-transparent (for dark backgrounds), "dark" blue-on-transparent. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Vector reproduction of the Dufat, Lda. wordmark: a large "D" monogram,
 * "UFAT" inside a solid block, and the small "LDA." mark.
 */
export function DufatLogo({ variant = "light", className }: Props) {
  const main = variant === "light" ? "#FFFFFF" : "#114F8C";
  const inverse = variant === "light" ? "#114F8C" : "#FFFFFF";

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
        fontFamily="var(--font-archivo), Arial Black, sans-serif"
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
        fontFamily="var(--font-archivo), Arial Black, sans-serif"
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
        fontFamily="var(--font-archivo), Arial, sans-serif"
        fontWeight="700"
        fontSize="15"
        fill={main}
      >
        LDA.
      </text>
    </svg>
  );
}
