import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "./cn";

const PIN =
  "inline-flex min-h-8 max-w-full items-center gap-2 rounded-full bg-coral py-1 pr-3.5 pl-2.5 text-small font-bold whitespace-nowrap text-on-coral";

/**
 * The pin (plan §32.1): a coral capsule pinned on the coastline, carrying the
 * one thing on the screen not to miss — "Allergy: Penicillin", "3 to bill",
 * "Plan ends 12 Nov". With `href` it opens where that thing is dealt with, and
 * takes a 44 px tap however small it is drawn.
 */
export function Pin({ label, icon: Icon, href }: { label: string; icon?: LucideIcon; href?: string }) {
  const body = (
    <>
      {Icon && <Icon size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{label}</span>
    </>
  );
  if (!href) return <span className={PIN}>{body}</span>;
  return (
    <Link
      href={href}
      className={cn(PIN, "relative transition-transform active:scale-[0.98] after:absolute after:-inset-1.5")}
    >
      {body}
    </Link>
  );
}
