import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { listConsoleErrors } from "@/features/admin/api";
import { ConsoleErrors } from "@/features/admin/components/ConsoleErrors";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.logs };

export default function ConsoleErrorsPage() {
  return (
    <ConsoleScreen pages={{ [apiRoutes.console.logs]: (admin) => listConsoleErrors(admin, {}) }}>
      <ConsoleErrors />
    </ConsoleScreen>
  );
}
