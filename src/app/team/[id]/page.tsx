import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { Member } from "@/features/team/components/Member";
import { getMember } from "@/features/team/members";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.team };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppScreen access="team.manage" queries={{ [apiRoutes.team.member(id)]: (tenant) => getMember(tenant, id) }}>
      <Member id={id} />
    </AppScreen>
  );
}
