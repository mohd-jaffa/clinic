import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { ROUTE_ACCESS } from "@/constants/permissions";
import { listActivity } from "@/features/activity/api";
import { ActivityLog } from "@/features/activity/components/ActivityLog";
import { activityKey } from "@/features/activity/keys";
import { listTeam } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.activity.title };

export default function ActivityPage() {
  return (
    <AppScreen
      access={ROUTE_ACCESS.owner}
      queries={{ [apiRoutes.team.list]: listTeam }}
      pages={{ [activityKey(null, null)]: (tenant) => listActivity(tenant, {}) }}
    >
      <ActivityLog />
    </AppScreen>
  );
}
