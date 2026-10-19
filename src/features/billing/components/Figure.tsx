import { cn } from "@/components/ui/cn";

/** One figure of a bill's totals, in a `dl`: its name, and its value at the right; the total set larger. */
export function Figure({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", lead && "border-t border-line pt-3")}>
      <dt className={lead ? "font-bold text-ink" : "text-muted"}>{label}</dt>
      <dd className={cn("text-right font-bold text-ink tabular-nums", lead && "text-heading")}>{value}</dd>
    </div>
  );
}
