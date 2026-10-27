"use client";

import { useId, useState } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { UI_TEXT } from "@/constants/messages";
import { REPORT_TAB_LABELS, REPORT_TABS, type ReportTab } from "@/constants/statuses";
import { monthStartKey, todayKey } from "@/lib/dates/calendar";

import { DailyReport } from "./DailyReport";
import { MonthlyReport } from "./MonthlyReport";

const OPTIONS = REPORT_TABS.map((tab) => ({ value: tab, label: REPORT_TAB_LABELS[tab] }));

/**
 * Reports — `/reports` (plan §18), for `reports.view`: **Daily** — today to
 * start — and **Monthly** — this month — each keeping the day or month
 * picked while the other is looked at. Every figure is worked out in the
 * database, in the clinic's timezone, as Home's are (0034).
 */
export function Reports() {
  const tabsId = useId();
  const [tab, setTab] = useState<ReportTab>("DAILY");
  const [day, setDay] = useState(todayKey);
  const [month, setMonth] = useState(() => monthStartKey(todayKey()));
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.nav.places.reports} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        <div className="max-w-6xl">
          <Tabs id={tabsId} label={UI_TEXT.reports.tabsLabel} value={tab} options={OPTIONS} onChange={setTab} />
          <TabPanel id={tabsId} value={tab}>
            {tab === "DAILY" ? (
              <DailyReport day={day} onDay={setDay} />
            ) : (
              <MonthlyReport month={month} onMonth={setMonth} />
            )}
          </TabPanel>
        </div>
      </div>
    </>
  );
}
