"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";

/**
 * The ＋ (plan §31.1, D69): a large round land-green chip raised above the
 * phone's bottom bar, a round one at the top of the tablet's rail, and an
 * **Add** capsule at the top of the desktop's sidebar. Each opens the same
 * Quick Actions lobe, and says that it does and whether it is open.
 */
export function AddButton({
  look,
  open,
  onClick,
}: {
  look: "bar" | "rail" | "sidebar";
  open: boolean;
  onClick: () => void;
}) {
  const label = UI_TEXT.quickActions.title;
  const opens = { "aria-haspopup": "dialog", "aria-expanded": open, onClick } as const;

  if (look === "sidebar") return <Button label={label} icon={Plus} fullWidth {...opens} />;

  if (look === "rail") {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        {...opens}
        className="grid size-14 place-items-center rounded-full bg-land text-land-ink transition-transform duration-(--duration-map) ease-map active:scale-95"
      >
        <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>
    );
  }

  // Taller than the bar's one row, and set to its foot, so the chip rises out
  // of the top of the bar; the ground around it cuts it out of the bar's edge.
  return (
    <button
      type="button"
      {...opens}
      className="group flex h-full w-full flex-col items-center justify-end gap-1 pb-2 text-tab font-bold text-ink"
    >
      <span className="grid size-15 shrink-0 place-items-center rounded-full bg-land text-land-ink ring-6 ring-ground transition-transform duration-(--duration-map) ease-map group-active:scale-95">
        <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}
