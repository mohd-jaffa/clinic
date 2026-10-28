"use client";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";
import { SUBSCRIPTION_PLAN_LABELS, type SubscriptionPlan } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { dayCount } from "@/lib/dates/calendar";
import { formatDate, formatDayMonth } from "@/lib/format/date";

import { usePlan } from "../hooks/usePlan";
import type { PlanView } from "../types";
import { HowToRenew } from "./HowToRenew";
import { PlanHistory } from "./PlanHistory";

const { plan: words } = UI_TEXT;

/** "Monthly plan", "Yearly plan" — and the trial as itself. */
const nameOf = (plan: SubscriptionPlan) =>
  plan === "TRIAL" ? SUBSCRIPTION_PLAN_LABELS.TRIAL : words.named(SUBSCRIPTION_PLAN_LABELS[plan]);

/** What the land says under the last day (D363): Active, or how near the end is, in a coral capsule. */
function stateOf(plan: PlanView): { label: string; note?: string } {
  const daysLeft = dayCount(plan.today, plan.validUntil) - 1;
  switch (plan.state) {
    case "ACTIVE":
      return { label: words.activeUntil };
    case "EXPIRING":
      return {
        label: words.validUntil,
        note: daysLeft === 0 ? words.endsToday : daysLeft === 1 ? words.endsTomorrow : words.endsIn(daysLeft),
      };
    case "GRACE":
      return { label: words.validUntil, note: words.endedViewOnlyFrom(formatDayMonth(plan.readOnlyFrom)) };
    case "READ_ONLY":
      return { label: words.validUntil, note: words.viewOnly };
  }
}

/**
 * The owner's Plan screen — `/settings/plan` (plan §7.5; D74, D363 – D366),
 * where How to renew leads. The land names the plan and holds its last day
 * in display numerals, with where it stands under it. On the ground: How to
 * renew — the prices and the renewal contact — and the history of every
 * change recorded to the plan, side by side on a desktop. It works in a
 * view-only clinic too: it is how the clinic gets out of one.
 */
export function PlanScreen() {
  const { membership } = useAuth();
  const query = usePlan();
  const plan = query.data;

  return (
    <>
      <CoastHeader>
        <div className="grid gap-5 pb-6">
          <PageHeader
            title={plan ? nameOf(plan.plan) : UI_TEXT.settings.items.plan.label}
            subtitle={membership?.clinicName}
            back={SETTINGS_ROUTE}
          />
          {plan && (
            <div className="max-w-md">
              <StatGrid>
                <StatTile on="land" value={formatDate(plan.validUntil)} {...stateOf(plan)} />
              </StatGrid>
            </div>
          )}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {plan ? (
          <div className="grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-2">
            <HowToRenew plan={plan} clinicName={membership?.clinicName ?? ""} />
            <PlanHistory payments={plan.payments} />
          </div>
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="PLAN_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}
