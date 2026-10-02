"use client";

import { useId, type ReactNode, type RefObject } from "react";

import { cn } from "./cn";
import { Modal } from "./modal";

/**
 * A card that asks or tells one thing and waits — the confirm card and the
 * response card are built on it (plan §32.2). On a phone it rises at the foot
 * of the screen, within thumb's reach and above the keyboard; from 768 px it
 * sits in the middle. Its title names it, its body says why, and its actions
 * stand at the end, the main one last — on a phone, one under another at full
 * width, the main one on top, nearest the thumb's reach and first to be read.
 */
export function Dialog({
  open,
  onDismiss,
  title,
  role = "dialog",
  initialFocus,
  actions,
  children,
}: {
  open: boolean;
  /** Escape and the backdrop; an `alertdialog` that must be answered has none. */
  onDismiss?: () => void;
  title: string;
  role?: "dialog" | "alertdialog";
  initialFocus?: RefObject<HTMLElement | null>;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <Modal
      open={open}
      onDismiss={onDismiss}
      labelledBy={headingId}
      role={role}
      initialFocus={initialFocus}
      motion="card"
      className={cn(
        "bg-surface shadow-raised",
        "fixed inset-x-3 top-auto bottom-[calc(var(--keyboard-inset)+var(--safe-bottom)+0.75rem)] w-auto rounded-sheet",
        "max-h-[calc(85dvh-var(--keyboard-inset))] overflow-y-auto",
        "md:inset-0 md:m-auto md:h-fit md:max-h-[85dvh] md:w-full md:max-w-md",
      )}
    >
      <div className="grid gap-3 p-6">
        <h2 id={headingId} className="text-title font-bold">
          {title}
        </h2>
        {children && <div className="text-muted">{children}</div>}
        {actions && <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </Modal>
  );
}
