import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listTeam } from "@/features/team/api";
import { Team } from "@/features/team/components/Team";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.team };

export default function TeamPage() {
  return (
    <AppScreen access="team.manage" queries={{ [apiRoutes.team.list]: listTeam }}>
      <Team />
    </AppScreen>
  );
}
