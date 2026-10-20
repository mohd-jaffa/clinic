import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";

/**
 * What a patient owes, as a coral chip on their row (plan §10.2, D101):
 * "₹1,200 due" — nothing when they owe nothing or hold an advance.
 */
export function OwingPill({ balancePaise }: { balancePaise: number }) {
  if (balancePaise <= 0) return null;
  return <StatusPill label={UI_TEXT.billing.due(formatPaise(balancePaise))} tone="attention" />;
}
