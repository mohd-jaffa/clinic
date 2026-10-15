import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { FOLLOW_UP_ACCESS } from "@/constants/permissions";
import { getClinic } from "@/features/clinic/api";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { listDoctors } from "@/features/team/api";
import { countFollowUps, listFollowUps } from "@/features/treatments/api";
import { FollowUps } from "@/features/treatments/components/FollowUps";
import { followUpsKey } from "@/features/treatments/keys";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.followUps };

export default function FollowUpsPage() {
  return (
    <AppScreen
      access={FOLLOW_UP_ACCESS.list}
      queries={{
        [apiRoutes.followUps.counts]: countFollowUps,
        [apiRoutes.clinic.profile]: getClinic,
        [apiRoutes.doctors.list]: listDoctors,
        [apiRoutes.appointmentTypes.list]: appointmentTypes.list,
      }}
      pages={{ [followUpsKey("TODAY")]: (tenant) => listFollowUps(tenant, { tab: "TODAY", cursor: undefined }) }}
    >
      <FollowUps />
    </AppScreen>
  );
}
