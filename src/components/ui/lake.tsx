import type { ReactNode } from "react";

/**
 * The lake (plan §32.1): the land opens in its middle and the patient now
 * with the doctor sits in the opening, the ground showing through — their
 * token in display size, their name, a line about them, and what to do next
 * (**Done**, **Next patient**). With no one in, it holds a warm line instead.
 * It is a region named by `label`, so a screen reader can go straight to it.
 */
export function Lake({
  label,
  lead,
  leadLabel,
  title,
  detail,
  children,
}: {
  label: string;
  /** The big numeral — a token, "07". */
  lead?: string;
  /** What the numeral is, for a screen reader: "Token". */
  leadLabel?: string;
  title: string;
  detail?: string;
  /** The actions, side by side. */
  children?: ReactNode;
}) {
  return (
    <section aria-label={label} className="grid gap-3.5 rounded-lake bg-ground px-[22px] pt-[22px] pb-6 text-ink">
      <div className="flex min-w-0 items-center gap-3.5">
        {lead && (
          <span className="shrink-0 text-display-lg font-bold tracking-[-0.03em] tabular-nums">
            {leadLabel && <span className="sr-only">{`${leadLabel} `}</span>}
            {lead}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-title font-bold">{title}</p>
          {detail && <p className="truncate text-small text-muted tabular-nums">{detail}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
    </section>
  );
}
