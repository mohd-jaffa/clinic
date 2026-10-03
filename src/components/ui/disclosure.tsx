"use client";

import { ChevronUp, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "./button";

/**
 * What a screen keeps out of the way until asked for — archived entries,
 * past holidays: a quiet toggle saying how many wait behind it, and what it
 * opens onto. Its words, not its padding, line up with the rows above it.
 */
export function Disclosure({
  label,
  showLabel,
  hideLabel,
  icon,
  className,
  children,
}: {
  /** What the section is, for a screen reader: "Archived". */
  label: string;
  /** "Show archived (3)". */
  showLabel: string;
  hideLabel: string;
  /** The toggle's mark while it is closed; open, it is a chevron up. */
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const contentId = useId();
  return (
    <section aria-label={label} className={className}>
      <div className="-ml-3.5">
        <Button
          label={shown ? hideLabel : showLabel}
          icon={shown ? ChevronUp : icon}
          variant="quiet"
          size="sm"
          aria-expanded={shown}
          aria-controls={contentId}
          onClick={() => setShown(!shown)}
        />
      </div>
      <div id={contentId} hidden={!shown} className="mt-3">
        {children}
      </div>
    </section>
  );
}
