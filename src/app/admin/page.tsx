import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { getConsoleOverview } from "@/features/admin/api";
import { ConsoleOverview } from "@/features/admin/components/ConsoleOverview";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.overview };

export default function ConsoleOverviewPage() {
  return (
    <ConsoleScreen queries={{ [apiRoutes.console.overview]: getConsoleOverview }}>
      <ConsoleOverview />
    </ConsoleScreen>
  );
}
