"use client";

import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { useAnchoredPopover } from "@/components/ui/anchored-popover";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { UI_TEXT } from "@/constants/messages";
import { MY_ACCOUNT_ROUTE } from "@/constants/navigation";
import { CLINIC_ROLE_LABELS, PLATFORM_ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left font-bold text-ink transition-colors duration-(--duration-map) ease-map hover:bg-ground";

/**
 * Who is signed in, at the foot of the tablet's rail and the desktop's
 * sidebar (plan §31.1): their initials — and from 1024 px their name and role
 * — opening a panel with where they work, **My account** and **Sign out**,
 * which closes it and asks first. The platform admin, in the console (D367),
 * is "Developer" and has no clinic, so no My account — only Sign out. A disclosure: a tap elsewhere, Escape or leaving it with
 * the keys closes it, Escape handing the focus back.
 */
export function AccountMenu() {
  const { profile, membership } = useAuth();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const control = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const { signingOut, signOut } = useSignOut(close);
  useAnchoredPopover({ open, panel, control, maxHeight: 360, onDismiss: close });

  const developer = profile?.platformRole === "DEV";
  if (!profile || (!membership && !developer)) return null;
  const role = membership ? CLINIC_ROLE_LABELS[membership.role] : PLATFORM_ROLE_LABELS.DEV;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    close();
    control.current?.focus();
  };

  // Once the focus has settled outside both the button and the panel, it closes.
  const leave = () =>
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active === control.current || panel.current?.contains(active)) return;
      close();
    });

  return (
    <div onKeyDown={onKeyDown}>
      <button
        ref={control}
        type="button"
        aria-label={UI_TEXT.nav.account(profile.fullName)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((shown) => !shown)}
        onBlur={leave}
        className="flex w-full items-center gap-3 rounded-full p-1.5 text-left transition-colors duration-(--duration-map) ease-map hover:bg-surface max-lg:justify-center lg:pr-3"
      >
        <Avatar name={profile.fullName} />
        <span className="hidden min-w-0 flex-1 lg:block">
          <span className="block truncate font-bold text-ink">{profile.fullName}</span>
          <span className="block truncate text-small text-muted">{role}</span>
        </span>
        <ChevronsUpDown
          size={18}
          strokeWidth={2.25}
          aria-hidden="true"
          className="hidden shrink-0 text-muted lg:block"
        />
      </button>

      <div
        ref={panel}
        id={panelId}
        popover="manual"
        onBlur={leave}
        className="animate-drop-in inset-auto m-0 w-72 max-w-[calc(100vw-1rem)] rounded-sheet border border-line bg-surface p-2 text-ink shadow-raised"
      >
        <div className="flex items-center gap-3 px-2 pt-2 pb-3">
          <Avatar name={profile.fullName} />
          <div className="min-w-0">
            <p className="truncate font-bold">{profile.fullName}</p>
            <p className="truncate text-small text-muted">
              {membership ? UI_TEXT.nav.membership(membership.clinicName, role) : role}
            </p>
          </div>
        </div>
        <ul role="list" className="grid gap-1 border-t border-line pt-2">
          {membership && (
            <li>
              <Link href={MY_ACCOUNT_ROUTE} onClick={close} className={ITEM}>
                <UserRound size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-muted" />
                {UI_TEXT.nav.myAccount}
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={() => {
                // The menu gives way to the question, and the answer finds the
                // focus on the account again.
                close();
                control.current?.focus();
                void signOut();
              }}
              aria-busy={signingOut || undefined}
              className={cn(ITEM, signingOut && "cursor-progress")}
            >
              <LogOut size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-muted" />
              {signingOut ? UI_TEXT.auth.signingOut : UI_TEXT.auth.signOut}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
