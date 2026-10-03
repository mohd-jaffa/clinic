import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { Settings } from "@/features/auth/components/Settings";

export const metadata: Metadata = { title: UI_TEXT.nav.places.settings };

export default function SettingsPage() {
  return (
    <AppScreen>
      <Settings />
    </AppScreen>
  );
}
