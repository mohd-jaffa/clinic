import { UI_TEXT } from "@/constants/messages";

import { cn } from "./cn";

const SIZES = {
  md: "text-title",
  lg: "text-heading",
} as const;

/**
 * The app's name as its mark (D61): the working name in Figtree bold, set a
 * little tight, in the colour of where it sits — ink on the ground, land-ink
 * on the land. Text only until the final name (Q1), so a rename is the one
 * constant in UI_TEXT and nothing here.
 */
export function Wordmark({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("font-bold leading-none tracking-[-0.02em] whitespace-nowrap", SIZES[size], className)}>
      {UI_TEXT.appName}
    </span>
  );
}
