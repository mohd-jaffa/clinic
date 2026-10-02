"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";

import { UI_TEXT } from "@/constants/messages";

import { IconButton } from "./button";
import { cn } from "./cn";
import { Modal } from "./modal";

/**
 * Where a create or edit form opens (plan §31.2): a bottom sheet on a phone,
 * riding above the keyboard, and a side panel on the right from 768 px, the
 * screen still in view beside it. A grab handle on a phone, the title with a
 * close button, a scrolling body and a foot for its actions, on the kit's
 * `Modal` — which keeps the page behind inert, moves focus in and back, and
 * stays mounted while closed. Focus goes to the first field of the body,
 * never the close button.
 */
export function Sheet({
  open,
  onClose,
  title,
  role = "dialog",
  dismissible = true,
  initialFocus,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the dialog. */
  title: string;
  role?: "dialog" | "alertdialog";
  /** Whether Escape, the backdrop and a close button can close it. */
  dismissible?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  /** Pinned under the scrolling body — the sheet's actions. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const body = useRef<HTMLDivElement>(null);

  return (
    <Modal
      open={open}
      onDismiss={dismissible ? onClose : undefined}
      labelledBy={headingId}
      role={role}
      initialFocus={initialFocus}
      focusScope={body}
      motion="sheet"
      className={cn(
        "bg-surface shadow-raised",
        "fixed inset-x-0 top-auto bottom-[var(--keyboard-inset)] w-full rounded-t-sheet",
        "max-h-[calc(92dvh-var(--keyboard-inset))]",
        "md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-dvh md:w-[28rem] md:rounded-l-sheet md:rounded-tr-none",
      )}
    >
      <div className="flex max-h-[inherit] flex-col md:h-full">
        <div className="flex justify-center pt-3 md:hidden" aria-hidden="true">
          <div className="h-1.5 w-12 rounded-full bg-line" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 pb-3 md:px-6 md:pt-6">
          <h2 id={headingId} className="text-title font-bold">
            {title}
          </h2>
          {dismissible && (
            <span className="-mr-2">
              <IconButton icon={X} label={UI_TEXT.actions.close} onClick={onClose} />
            </span>
          )}
        </div>

        <div
          ref={body}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 md:px-6",
            footer ? "pb-4" : "safe-bottom [--safe-pb:1.5rem]",
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="safe-bottom [--safe-pb:1rem] shrink-0 border-t border-line bg-surface px-5 pt-4 md:px-6">
            {footer}
          </div>
        )}
      </div>
    </Modal>
  );
}
