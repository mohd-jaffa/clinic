"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

import { cn } from "./cn";
import { openLayer } from "./top-layer";

// What Tab stops at: a control out of the Tab order — a radio group's other
// choices — is not where a modal begins.
const FOCUSABLE = ["input", "select", "textarea", "button", "a[href]", "[tabindex]"]
  .map((selector) => `${selector}:not([tabindex='-1'])`)
  .join(", ");

/** How each kind of modal comes and goes (`globals.css`): a sheet, a card, the Quick Actions lobe. */
export type ModalMotion = "sheet" | "card" | "lobe";

/**
 * A modal on the native `<dialog>`, ported from Brio. The sheet, the dialog
 * card and the Quick Actions lobe are built on it, each placing it where it
 * belongs; what a modal owes a keyboard and a screen reader lives here once
 * (plan §32.2):
 *
 * - **The page behind is inert.** `showModal()` puts it in the top layer and
 *   makes everything else unreachable — by Tab, by a screen reader, by a
 *   pointer — and Tab goes round inside it, first to last and back.
 * - **Focus** moves in when it opens — to `initialFocus`, else the first
 *   field in `focusScope`, else the first control there — and goes back to
 *   whatever opened it when it closes.
 * - **Escape** and a tap on the backdrop call `onDismiss`, when there is one.
 * - **It stays mounted while closed.** A closed `<dialog>` is simply not
 *   drawn, so a form inside it keeps what was typed (D55).
 * - **The page does not scroll behind it.**
 * - **It carries what is said over it.** Everything outside it is inert, so
 *   while it is on top a notice that closes itself is drawn, reached and read
 *   out from inside it (`top-layer.ts`).
 */
export function Modal({
  open,
  onDismiss,
  labelledBy,
  role = "dialog",
  initialFocus,
  focusScope,
  motion,
  className,
  children,
}: {
  open: boolean;
  /** Escape and the backdrop; without it, only a choice inside closes it. */
  onDismiss?: () => void;
  labelledBy: string;
  role?: "dialog" | "alertdialog";
  initialFocus?: RefObject<HTMLElement | null>;
  /** Where to look for the first field or control; the whole modal by default. */
  focusScope?: RefObject<HTMLElement | null>;
  motion: ModalMotion;
  /** Where it sits and how it is drawn — the sheet's, the card's or the lobe's. */
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const notices = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);

  // On top from the moment it opens, and off the moment it closes: a layout
  // effect, so a form that closes as its outcome appears is already off when
  // the notice looks for where to go.
  useLayoutEffect(() => {
    if (!open || !notices.current || !status.current) return;
    return openLayer({ notices: notices.current, status: status.current });
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;

    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    if (!element.open) element.showModal();
    document.body.style.overflow = "hidden";

    const scope = focusScope?.current ?? element;
    const firstField = scope.querySelector<HTMLElement>("input, select, textarea");
    const firstControl = scope.querySelector<HTMLElement>(FOCUSABLE);
    (initialFocus?.current ?? firstField ?? firstControl)?.focus();

    return () => {
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocus, focusScope]);

  return (
    <dialog
      ref={dialog}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // Escape. The modal closes when its owner says so, not on its own.
        // A modal opened from inside this one (a picker over a form) is its
        // own: React hands its Escape to this one too, which would close both.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onDismiss?.();
      }}
      onClick={(event) => {
        // Only the backdrop is the dialog itself; the panel fills it.
        if (event.target === event.currentTarget) onDismiss?.();
      }}
      onKeyDown={(event) => {
        // Tab goes round inside. A modal dialog already keeps the page out of
        // reach; this also keeps focus from stepping out to the browser's own
        // toolbar between the last control and the first.
        if (event.key !== "Tab" || (event.target as Element).closest("dialog") !== event.currentTarget) return;
        const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (stop) => !stop.hasAttribute("disabled") && stop.getClientRects().length > 0,
        );
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      className={cn(`modal-${motion}`, "m-0 max-w-none border-0 p-0 text-ink backdrop:bg-scrim", className)}
    >
      {children}
      <div ref={notices} data-modal-notices="" />
      <p ref={status} role="status" aria-live="polite" className="sr-only" />
    </dialog>
  );
}
