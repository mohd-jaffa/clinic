"use client";

import { Lock, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef } from "react";

import { UI_TEXT } from "@/constants/messages";

import { IconButton } from "./button";
import { cn } from "./cn";
import { Coastline } from "./coast-header";
import { Modal } from "./modal";

/** One thing the ＋ can start: a place to go, or a sheet to open where the person is. */
export type QuickAction = { key: string; label: string; icon: LucideIcon } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
);

const ACTION =
  "flex min-h-14 w-full items-center gap-3 rounded-full bg-surface py-1.5 pr-1.5 pl-5 text-left text-body font-bold text-ink transition-transform duration-(--duration-map) ease-map active:scale-[0.98]";

/**
 * The Quick Actions lobe (plan §32.1): the ＋ in the phone's bottom bar raises
 * a lobe of land from the bottom, its top edge a coastline, holding capsule
 * actions — Walk-in, Appointment, Patient, Payment, Expense — already filtered
 * to what the person may do, one under another on a phone so every word fits,
 * two side by side from 640 px. Each is a capsule whose chip rides its
 * trailing edge, as every capsule's does at rest. From 768 px the lobe drops
 * from the rail's ＋ and the sidebar's **Add**, beside them at the top, its
 * lower edge the coastline (D76). Focus goes to the first action; Escape, a
 * tap outside it or the close button lets it go back, and the focus returns
 * to the ＋. Taking an action closes it on the way.
 *
 * `blocked` is why none can be taken now — a view-only clinic (plan §7.2):
 * it is said under the title, and each action stays in sight, turned off,
 * with that reason as its description.
 */
export function QuickActions({
  open,
  onClose,
  actions,
  blocked,
}: {
  open: boolean;
  onClose: () => void;
  actions: readonly QuickAction[];
  blocked?: string;
}) {
  const headingId = useId();
  const reasonId = useId();
  const list = useRef<HTMLUListElement>(null);
  return (
    <Modal
      open={open}
      onDismiss={onClose}
      labelledBy={headingId}
      focusScope={list}
      motion="lobe"
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 w-full bg-transparent",
        // Beside the rail (6.5rem) or the sidebar (17rem), level with its ＋.
        "md:top-[calc(var(--safe-top)+1rem)] md:right-auto md:bottom-auto md:left-[calc(7rem+var(--safe-left))] md:w-[22rem]",
        "lg:left-[calc(17.5rem+var(--safe-left))]",
      )}
    >
      <div className="md:hidden">
        <Coastline name="phone" flip />
      </div>
      <div className="safe-bottom [--safe-pb:1.5rem] bg-land px-4 text-land-ink md:rounded-t-sheet md:pt-3 md:[--safe-pb:0.5rem]">
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 id={headingId} className="text-title font-bold">
            {UI_TEXT.quickActions.title}
          </h2>
          <span className="-mr-1.5">
            <IconButton icon={X} label={UI_TEXT.actions.close} onClick={onClose} />
          </span>
        </div>
        {blocked && (
          <p id={reasonId} className="-mt-1 flex items-start gap-2 pb-3 text-small font-bold">
            <Lock size={18} strokeWidth={2.25} aria-hidden="true" className="mt-px shrink-0" />
            {blocked}
          </p>
        )}
        <ul ref={list} role="list" className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-1 md:gap-2.5">
          {actions.map((action) => {
            const { key, label, icon: Icon } = action;
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-chip text-on-chip"
                >
                  <Icon size={20} strokeWidth={2.25} />
                </span>
              </>
            );
            return (
              <li key={key} className="min-w-0 sm:last:odd:col-span-2 md:last:odd:col-span-1">
                {blocked ? (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-describedby={reasonId}
                    className={cn(ACTION, "cursor-not-allowed opacity-60 active:scale-100")}
                  >
                    {body}
                  </button>
                ) : action.href ? (
                  <Link href={action.href} onClick={onClose} className={ACTION}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      action.onClick!();
                    }}
                    className={ACTION}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden md:block">
        <Coastline name="phone" />
      </div>
    </Modal>
  );
}
