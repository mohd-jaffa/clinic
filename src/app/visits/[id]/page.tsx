import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getVisit } from "@/features/visits/api";
import { VisitScreen } from "@/features/visits/components/VisitScreen";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.visit.title };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppScreen access="visits.view" queries={{ [apiRoutes.visits.one(id)]: (tenant) => getVisit(tenant, id) }}>
      <VisitScreen id={id} />
    </AppScreen>
  );
}
