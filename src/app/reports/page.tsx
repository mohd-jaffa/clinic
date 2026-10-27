import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getDailyReport, getMonthlyReport } from "@/features/reports/api";
import { Reports } from "@/features/reports/components/Reports";
import { dailyReportKey, monthlyReportKey } from "@/features/reports/keys";
import { monthStartKey, todayKey } from "@/lib/dates/calendar";

export const metadata: Metadata = { title: UI_TEXT.nav.places.reports };

export default function ReportsPage() {
  // Today and this month, as the screen opens on them; read at once.
  const day = todayKey();
  const month = monthStartKey(day);
  return (
    <AppScreen
      access="reports.view"
      queries={{
        [dailyReportKey(day)]: (tenant) => getDailyReport(tenant, { day }),
        [monthlyReportKey(month)]: (tenant) => getMonthlyReport(tenant, { month }),
      }}
    >
      <Reports />
    </AppScreen>
  );
}
