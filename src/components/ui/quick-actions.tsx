"use client";

import { X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef } from "react";

import { UI_TEXT } from "@/constants/messages";

import { IconButton } from "./button";
import { Coastline } from "./coast-header";
import { Modal } from "./modal";

/** One thing the ＋ can start: a place to go, or a sheet to open where the person is. */
export type QuickAction = { key: string; label: string; icon: LucideIcon } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
);

const ACTION =
  "flex min-h-14 w-full items-center gap-3 rounded-full bg-surface py-1.5 pr-5 pl-1.5 text-left text-body font-bold text-ink transition-transform duration-(--duration-map) ease-map active:scale-[0.98]";

/**
 * The Quick Actions lobe (plan §32.1): the ＋ in the phone's bottom bar raises
 * a lobe of land from the bottom, its top edge a coastline, holding capsule
 * actions — Walk-in, Appointment, Patient, Payment, Expense — already filtered
 * to what the person may do. Focus goes to the first action; Escape, a tap
 * above it or the close button lets it sink back, and the focus returns to
 * the ＋. Taking an action closes it on the way.
 */
export function QuickActions({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: readonly QuickAction[];
}) {
  const headingId = useId();
  const list = useRef<HTMLUListElement>(null);
  return (
    <Modal
      open={open}
      onDismiss={onClose}
      labelledBy={headingId}
      focusScope={list}
      motion="lobe"
      className="fixed inset-x-0 top-auto bottom-0 w-full bg-transparent md:mx-auto md:max-w-xl"
    >
      <Coastline name="phone" flip />
      <div className="safe-bottom [--safe-pb:1.5rem] bg-land px-4 text-land-ink">
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 id={headingId} className="text-title font-bold">
            {UI_TEXT.quickActions.title}
          </h2>
          <span className="-mr-1.5">
            <IconButton icon={X} label={UI_TEXT.actions.close} onClick={onClose} />
          </span>
        </div>
        <ul ref={list} role="list" className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const { key, label, icon: Icon } = action;
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-chip text-on-chip"
                >
                  <Icon size={20} strokeWidth={2.25} />
                </span>
                <span className="truncate">{label}</span>
              </>
            );
            return (
              <li key={key} className="min-w-0 last:odd:col-span-2">
                {action.href ? (
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
    </Modal>
  );
}
