import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "./cn";

/**
 * The Clinic Map's control (plan §32.1): a capsule with a round chip riding
 * its trailing edge. When the thing is live — a patient sent in to the
 * doctor — the chip crosses to the leading edge, so its place says what the
 * label says, and colour never carries the state alone.
 *
 * The chip is set against the capsule's edges rather than laid out beside the
 * label, so crossing is a glide of its position and of the label's padding,
 * on the map's one duration and curve (instant under reduced motion).
 */
export type CapsuleTone = "action" | "danger" | "surface";
export type CapsuleSize = "md" | "sm";
export type ChipAt = "trailing" | "leading";

const TONES: Record<CapsuleTone, { body: string; chip: string }> = {
  action: { body: "bg-action text-on-action", chip: "bg-chip text-on-chip" },
  danger: { body: "bg-coral text-on-coral", chip: "bg-on-coral text-coral" },
  surface: { body: "bg-surface text-ink ring-1 ring-line ring-inset", chip: "bg-chip text-on-chip" },
};

/**
 * Each size keeps a 44 px target. The chip sits 5 px (7 px small) in from the
 * edge it rides, and the label clears it by 10 px (8 px).
 */
const SIZES: Record<CapsuleSize, { body: string; chip: string; icon: number; pad: Record<ChipAt, string> }> = {
  md: {
    body: "min-h-11 text-body",
    chip: "size-[34px]",
    icon: 18,
    pad: { trailing: "pl-[18px] pr-[49px]", leading: "pl-[49px] pr-[18px]" },
  },
  sm: {
    body: "min-h-11 text-small",
    chip: "size-[30px]",
    icon: 16,
    pad: { trailing: "pl-[14px] pr-[45px]", leading: "pl-[45px] pr-[14px]" },
  },
};

const CHIP_AT: Record<CapsuleSize, Record<ChipAt, string>> = {
  md: { trailing: "left-[calc(100%-39px)]", leading: "left-[5px]" },
  sm: { trailing: "left-[calc(100%-37px)]", leading: "left-[7px]" },
};

const GLIDE = "duration-(--duration-map) ease-map";

/** The capsule's own classes: its fill, its size, and room for the chip on the side it rides. */
export function capsuleClasses({ tone, size, at }: { tone: CapsuleTone; size: CapsuleSize; at: ChipAt }): string {
  return cn(
    "relative inline-flex items-center justify-center rounded-full font-bold whitespace-nowrap",
    "transition-[padding,background-color,color,transform]",
    GLIDE,
    TONES[tone].body,
    SIZES[size].body,
    SIZES[size].pad[at],
  );
}

/** The round chip, on the side it rides, holding its icon — or a spinner while the work is on its way. */
export function CapsuleChip({
  tone,
  size,
  at,
  icon: Icon,
  busy = false,
}: {
  tone: CapsuleTone;
  size: CapsuleSize;
  at: ChipAt;
  icon: LucideIcon;
  busy?: boolean;
}) {
  const iconSize = SIZES[size].icon;
  return (
    <span
      aria-hidden="true"
      data-chip={at}
      className={cn(
        "absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full transition-[left]",
        GLIDE,
        TONES[tone].chip,
        SIZES[size].chip,
        CHIP_AT[size][at],
      )}
    >
      {busy ? (
        <Loader2 size={iconSize} strokeWidth={2.5} className="animate-spin" />
      ) : (
        <Icon size={iconSize} strokeWidth={2.5} />
      )}
    </span>
  );
}

/**
 * A capsule that only says where something stands — "Waiting", "With the
 * doctor" — with its chip trailing, or leading once `live`. The words say the
 * state; the chip's side repeats it.
 */
export function Capsule({
  label,
  icon,
  live = false,
  tone = "surface",
  size = "sm",
}: {
  label: string;
  /** What the chip holds: the state's mark — a clock while waiting, a check once in. */
  icon: LucideIcon;
  live?: boolean;
  tone?: CapsuleTone;
  size?: CapsuleSize;
}) {
  const at: ChipAt = live ? "leading" : "trailing";
  return (
    <span data-live={live || undefined} className={capsuleClasses({ tone, size, at })}>
      {label}
      <CapsuleChip tone={tone} size={size} at={at} icon={icon} />
    </span>
  );
}
