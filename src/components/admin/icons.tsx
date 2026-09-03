type IconProps = { className?: string };

function base(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** Dashboard gauge */
export function IconGauge({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 15l3.5-5.5" />
      <path d="M4.5 17.5a8.5 8.5 0 1 1 15 0" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Product box */
export function IconBox({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M21 8.5v7a2 2 0 0 1-1.1 1.8l-7 3.5a2 2 0 0 1-1.8 0l-7-3.5A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1.1-1.8l7-3.5a2 2 0 0 1 1.8 0l7 3.5A2 2 0 0 1 21 8.5Z" />
      <path d="M3.3 7.3 12 11.6l8.7-4.3" />
      <path d="M12 21.5v-9.9" />
    </svg>
  );
}

/** Case-study book */
export function IconBook({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20" />
      <path d="M8 7h8" />
      <path d="M8 11h5" />
    </svg>
  );
}

/** Quotes inbox */
export function IconInbox({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M22 12h-5.5l-1.5 3h-6l-1.5-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
    </svg>
  );
}

/** Contact envelope */
export function IconMail({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

/** Subscribers */
export function IconUsers({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.6 15.1c1.6.6 2.6 2 3 4.4" />
    </svg>
  );
}

/** External link arrow */
export function IconExternal({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

/** Plus */
export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** Logout */
export function IconLogout({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 8-4 4 4 4" />
      <path d="M6 12h9" />
    </svg>
  );
}

/** Sun (light theme) */
export function IconSun({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  );
}

/** Moon (dark theme) */
export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/** Image placeholder */
export function IconImage({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m4 17 4.8-4.4a1.5 1.5 0 0 1 2 0L16 17.5" />
      <path d="m14 15.5 2.2-2a1.5 1.5 0 0 1 2 0L21 16" />
    </svg>
  );
}

/** Shield — audit trail */
export function IconShield({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Settings gear */
export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Activity sheet */
export function IconClipboard({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
      <path d="M16 6h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}

/** Award trophy */
export function IconTrophy({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.5 2.5" />
      <path d="M16 6h2.5a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 20a2 2 0 0 1 4 0" />
    </svg>
  );
}

/** Downloadable / export */
export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 4v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

/** Disclosure chevron for collapsible nav groups */
export function IconChevron({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Warning triangle — confirmations and destructive prompts */
export function IconAlert({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10.3 4.3 2.6 17.6a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Eye — password currently hidden, tap to reveal */
export function IconEye({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Struck-through eye — password currently visible, tap to hide */
export function IconEyeOff({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.9 5.7A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7" />
      <path d="M6.4 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3.5 3.5 17 17" />
    </svg>
  );
}
