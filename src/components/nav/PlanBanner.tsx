"use client";

import { ArrowRight, CalendarClock, Lock, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui/cn";
import { UI_TEXT } from "@/constants/messages";
import { PLAN_ROUTE } from "@/constants/navigation";
import type { SubscriptionState } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDayMonth } from "@/lib/format/date";

const { plan } = UI_TEXT;

const ICONS: Record<Exclude<SubscriptionState, "ACTIVE">, LucideIcon> = {
  EXPIRING: CalendarClock,
  GRACE: TriangleAlert,
  READ_ONLY: Lock,
};

/** How to renew (D74): to the Plan screen. */
function Renew({ className }: { className: string }) {
  return (
    <Link href={PLAN_ROUTE} className={cn("font-bold text-ink underline decoration-2 underline-offset-4", className)}>
      {plan.howToRenew}
      <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" className="ml-1 inline align-[-0.15em]" />
    </Link>
  );
}

/**
 * The plan banner (plan §7.2, §31.1, D73): a slim band across the top of
 * every signed-in screen, above its land, while the clinic's plan is not
 * `ACTIVE` — from the session view, so no screen asks again.
 *
 * - **Ending soon:** a quiet band, "Your plan ends on 12 Nov."
 * - **Ended, in grace:** coral, the day it ended and the day the clinic
 *   becomes view-only; it still works in full.
 * - **View-only:** coral, and it stays.
 *
 * The owner is told it of their plan and offered **How to renew**, which
 * leads to the Plan screen (D74); everyone else is told it of the clinic.
 * The state is in the words and the icon, never the colour alone. It leads
 * the screen, so it pays the top safe area and the land under it does not.
 */
export function PlanBanner() {
  const { membership, subscription } = useAuth();
  if (!membership || !subscription || subscription.state === "ACTIVE") return null;

  const { state, validUntil, readOnlyFrom } = subscription;
  const owner = membership.role === "OWNER";
  const ended = formatDayMonth(validUntil);
  const viewOnly = formatDayMonth(readOnlyFrom);
  const words = {
    EXPIRING: owner ? plan.endsOn(ended) : plan.clinicEndsOn(ended),
    GRACE: owner ? plan.endedOn(ended, viewOnly) : plan.clinicEndedOn(ended, viewOnly),
    READ_ONLY: owner ? plan.readOnly : plan.clinicReadOnly,
  }[state];
  const attention = state !== "EXPIRING";
  const Icon = ICONS[state];

  return (
    <section
      aria-label={plan.banner}
      data-band=""
      className={cn(
        "safe-top flex items-start gap-x-3 px-4 pb-1.5 [--safe-pt:0.375rem] md:px-8",
        attention ? "bg-coral-soft" : "border-b border-line bg-surface",
      )}
    >
      <Icon
        size={20}
        strokeWidth={2.25}
        aria-hidden="true"
        className={cn("mt-3 shrink-0", attention ? "text-coral" : "text-muted")}
      />
      <p className="min-w-0 flex-1 py-2.5 text-small font-bold text-ink">
        {words}
        {owner && (
          <>
            {" "}
            {/* On a phone it follows the words, so the band stays slim; beside them from 640 px. */}
            <Renew className="py-3 whitespace-nowrap sm:hidden" />
          </>
        )}
      </p>
      {owner && <Renew className="hidden min-h-11 shrink-0 items-center sm:inline-flex" />}
    </section>
  );
}
