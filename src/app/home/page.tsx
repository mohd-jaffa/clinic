import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { Home } from "@/features/dashboard/components/Home";

export const metadata: Metadata = { title: UI_TEXT.nav.places.home };

export default function HomePage() {
  return (
    <AppScreen>
      <Home />
    </AppScreen>
  );
}
