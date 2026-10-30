import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { getConsoleSettings } from "@/features/admin/api";
import { ConsoleSettings } from "@/features/admin/components/ConsoleSettings";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.settings };

export default function ConsoleSettingsPage() {
  return (
    <ConsoleScreen queries={{ [apiRoutes.console.settings]: getConsoleSettings }}>
      <ConsoleSettings />
    </ConsoleScreen>
  );
}
