import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { ROUTE_ACCESS } from "@/constants/permissions";
import { getPlan } from "@/features/subscription/api";
import { PlanScreen } from "@/features/subscription/components/PlanScreen";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.plan.label };

export default function PlanPage() {
  return (
    <AppScreen access={ROUTE_ACCESS.owner} queries={{ [apiRoutes.subscription.plan]: getPlan }}>
      <PlanScreen />
    </AppScreen>
  );
}
