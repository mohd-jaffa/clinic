import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { UI_TEXT } from "@/constants/messages";

/**
 * A screen's title block, on its land (`CoastHeader`, plan §32.1): a way
 * back, the title — the screen's one first-level heading — a line saying what
 * it is for, and the controls that belong beside it. The controls stay beside
 * the title while it keeps 15rem; wider ones drop to their own line on a
 * phone rather than squeezing it.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Where the back arrow goes; none on a top-level screen. */
  back?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-3 text-land-ink">
      <div className="flex min-w-[min(100%,15rem)] flex-1 items-start gap-1">
        {back && (
          <Link
            href={back}
            aria-label={UI_TEXT.actions.back}
            className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-land-ink/10"
          >
            <ArrowLeft size={24} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-heading font-bold tracking-[-0.01em] md:text-display">{title}</h1>
          {subtitle && <p className="mt-1.5 text-land-muted md:mt-3 md:text-title">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
