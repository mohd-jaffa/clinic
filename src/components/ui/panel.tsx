import { useId, type ReactNode } from "react";

import { cn } from "./cn";
import { SectionHeading } from "./section-heading";

/**
 * A part of a screen that holds its own form or read-out — a visit's vitals,
 * its notes (D202): titled on the ground, its body on a surface card, and
 * what it saves at the card's foot. The section is named by its title.
 */
export function Panel({
  title,
  footer,
  className,
  children,
}: {
  title: string;
  /** What the card ends with — its Save — or nothing. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("min-w-0", className)}>
      <SectionHeading id={id} title={title} />
      <div className="grid gap-4 rounded-row bg-surface p-4 sm:p-5">
        {children}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </section>
  );
}
