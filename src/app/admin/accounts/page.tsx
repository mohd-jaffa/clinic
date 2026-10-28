import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { listConsoleAccounts } from "@/features/admin/api";
import { ConsoleAccounts } from "@/features/admin/components/ConsoleAccounts";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.accounts };

export default function ConsoleAccountsPage() {
  return (
    <ConsoleScreen pages={{ [apiRoutes.console.accounts]: (admin) => listConsoleAccounts(admin, {}) }}>
      <ConsoleAccounts />
    </ConsoleScreen>
  );
}
