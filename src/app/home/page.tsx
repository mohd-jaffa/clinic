import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getDashboard } from "@/features/dashboard/api";
import { Home } from "@/features/dashboard/components/Home";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.home };

export default function HomePage() {
  return (
    <AppScreen queries={{ [apiRoutes.dashboard.home]: getDashboard }}>
      <Home />
    </AppScreen>
  );
}
