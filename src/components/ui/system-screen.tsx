import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { Wordmark } from "./wordmark";

const TONES = {
  /** A way that is not there: a lobe of land, nothing to worry about. */
  land: "bg-land text-land-ink",
  /** Something failed: coral, for attention (plan §32.1). */
  attention: "bg-coral-soft text-coral",
} as const;

/**
 * A whole-screen stop (plan §31.2, ported from Brio): a page that is not
 * there, or a screen that failed. It stands on the ground on its own, outside
 * the shell, because the shell may be what failed — so the app's name sits at
 * its top, to say where the person is. A lobe with its mark, a title, why, a
 * reference to quote when asking for help — never the error's own text — and
 * always a way on.
 */
export function SystemScreen({
  icon: Icon,
  tone,
  title,
  body,
  reference,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  body: string;
  reference?: string;
  /** The actions: a retry where one makes sense, and the way back. */
  children: ReactNode;
}) {
  return (
    <main className="safe-top safe-bottom safe-x flex min-h-dvh flex-col bg-ground text-ink [--safe-pb:2rem] [--safe-pt:1.25rem] [--safe-px:1.5rem]">
      <Wordmark />
      <div className="m-auto flex w-full max-w-sm flex-col items-center py-12 text-center">
        <span aria-hidden="true" className={cn("mb-6 grid size-20 place-items-center rounded-lobe", TONES[tone])}>
          <Icon size={32} strokeWidth={2} />
        </span>
        <h1 className="text-heading font-bold">{title}</h1>
        <p className="mt-3 text-pretty text-muted">{body}</p>
        {reference && <p className="mt-3 text-caption text-muted tabular-nums select-all">{reference}</p>}
        <div className="mt-8 grid w-full gap-3">{children}</div>
      </div>
    </main>
  );
}
