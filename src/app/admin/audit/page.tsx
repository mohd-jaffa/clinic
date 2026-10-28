import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { listConsoleAudit } from "@/features/admin/api";
import { ConsoleAudit } from "@/features/admin/components/ConsoleAudit";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.audit };

export default function ConsoleAuditPage() {
  return (
    <ConsoleScreen pages={{ [apiRoutes.console.audit]: (admin) => listConsoleAudit(admin, {}) }}>
      <ConsoleAudit />
    </ConsoleScreen>
  );
}
