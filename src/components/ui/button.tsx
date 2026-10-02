"use client";

import { ArrowRight, Loader2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { CapsuleChip, capsuleClasses, type CapsuleSize, type CapsuleTone, type ChipAt } from "./capsule";
import { cn } from "./cn";

/**
 * Every button in the app, as the Clinic Map's capsules (plan §32.1):
 *
 * - **primary** — the green capsule with the ink chip: the one thing to do.
 * - **danger** — the coral capsule, for what cannot be undone.
 * - **secondary** — the ink outline capsule, beside a primary.
 * - **quiet** — the words alone, for a way out ("Cancel").
 *
 * A primary or danger capsule always has its chip, with its icon (an arrow
 * unless it says otherwise); `live` sends the chip to the leading edge. One
 * declaration here means one look, and a 44 px target that cannot be
 * forgotten (AGENTS.md §23).
 */
export type ButtonVariant = "primary" | "danger" | "secondary" | "quiet";
export type ButtonSize = CapsuleSize;

const CHIPPED: Partial<Record<ButtonVariant, CapsuleTone>> = { primary: "action", danger: "danger" };

const PLAIN: Record<"secondary" | "quiet", string> = {
  secondary: "text-ink ring-2 ring-inset ring-ink hover:bg-ink/5",
  quiet: "text-action hover:bg-action-soft",
};

const PLAIN_SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-[18px] text-body",
  sm: "min-h-11 px-[14px] text-small",
};

const PRESS = "enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

interface Look {
  variant: ButtonVariant;
  size: ButtonSize;
  live: boolean;
  fullWidth: boolean;
}

/** A capsule's classes and what goes inside it, for a button and for a link alike. */
function capsule(
  { variant, size, live, fullWidth }: Look,
  icon: LucideIcon | undefined,
  busy: boolean,
  label: ReactNode,
) {
  const tone = CHIPPED[variant];
  if (tone) {
    const at: ChipAt = live ? "leading" : "trailing";
    return {
      className: cn(capsuleClasses({ tone, size, at }), fullWidth && "w-full"),
      body: (
        <>
          {label}
          <CapsuleChip tone={tone} size={size} at={at} icon={icon ?? ArrowRight} busy={busy} />
        </>
      ),
    };
  }
  const Icon = busy ? Loader2 : icon;
  return {
    className: cn(
      "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[background-color,transform]",
      "duration-(--duration-map) ease-map",
      PLAIN[variant as keyof typeof PLAIN],
      PLAIN_SIZES[size],
      fullWidth && "w-full",
    ),
    body: (
      <>
        {Icon && <Icon size={18} strokeWidth={2.5} aria-hidden="true" className={cn(busy && "animate-spin")} />}
        {label}
      </>
    ),
  };
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** For a card that puts the focus on it first. */
  ref?: Ref<HTMLButtonElement>;
  label?: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** The chip on the leading edge: the thing is under way. */
  live?: boolean;
  /** A spinner in the chip, and further presses refused. */
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  children,
  variant = "primary",
  size = "md",
  icon,
  live = false,
  loading = false,
  fullWidth = false,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const { className, body } = capsule({ variant, size, live, fullWidth }, icon, loading, children ?? label);
  return (
    <button
      type={type}
      // Busy is not disabled: a disabled button drops focus, so the response
      // card that follows would have nothing to give it back to. It stays
      // focusable, says it is busy, and ignores a press — a submit included —
      // until the work is done.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(className, PRESS, "aria-disabled:cursor-progress")}
      {...rest}
    >
      {body}
    </button>
  );
}

/**
 * A link that looks like a button — "Add a patient" on an empty list, Call and
 * WhatsApp on a profile. It stays an anchor, so it can be opened in a new tab
 * and read as a link. A place in the app goes through the router; anything
 * else — `tel:`, `wa.me` — is a plain anchor, and `newTab` opens it beside the
 * app without handing it the app's window.
 */
export function LinkButton({
  href,
  label,
  accessibleName,
  newTab = false,
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  onClick,
}: {
  href: string;
  label: string;
  /** A fuller name for a screen reader, which must begin with `label`: "Call Meena Gupta". */
  accessibleName?: string;
  newTab?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  fullWidth?: boolean;
  /** As it is followed: a card closing as its link takes the person on. */
  onClick?: () => void;
}) {
  const { className, body } = capsule({ variant, size, live: false, fullWidth }, icon, false, label);
  const props = {
    href,
    onClick,
    "aria-label": accessibleName,
    className: cn(className, "active:scale-[0.98]"),
    ...(newTab && { target: "_blank", rel: "noopener noreferrer" }),
  };
  return href.startsWith("/") ? <Link {...props}>{body}</Link> : <a {...props}>{body}</a>;
}

const ICON_TONES = {
  plain: "text-current hover:bg-current/10",
  outline: "bg-surface text-ink ring-1 ring-inset ring-edge hover:bg-ground",
  danger: "text-coral hover:bg-coral-soft",
} as const;

/** A round, label-less action — close, edit, the calendar's next month. */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = "plain",
  disabled,
}: {
  icon: LucideIcon;
  /** Never optional: the icon alone says nothing to a screen reader. */
  label: string;
  onClick: () => void;
  tone?: keyof typeof ICON_TONES;
  /** Shown, but with nothing to do: the calendar's Previous at the first month it may show. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform]",
        "duration-(--duration-map) ease-map enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        ICON_TONES[tone],
      )}
    >
      <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}
