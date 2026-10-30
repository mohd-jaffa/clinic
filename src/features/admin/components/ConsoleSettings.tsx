"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList } from "@/components/ui/detail-list";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { PLATFORM_SETTING_GROUPS, type PlatformSettingGroup, type PlatformSettings } from "@/constants/platform";
import { formatDateTime } from "@/lib/format/date";

import { useConsoleSettings } from "../hooks/useConsoleSettings";
import { showSetting } from "../settings";
import type { ConsoleSettings as Settings } from "../types";
import { SettingsSheet } from "./SettingsSheet";

const { console: words } = UI_TEXT;
const GROUPS = Object.keys(PLATFORM_SETTING_GROUPS) as PlatformSettingGroup[];

/** Who last changed the settings, and when; or only when, before anyone has. */
const changedLine = ({ updatedAt, updatedBy }: Settings) =>
  updatedBy ? words.lastChanged(updatedBy, formatDateTime(updatedAt)) : words.lastChangedAt(formatDateTime(updatedAt));

/**
 * The platform settings — `/admin/settings` (plan §6, §20.4; D378 – D381).
 * The land says who last changed them, and when. On the ground, the groups
 * — Trial and pricing · Expiry · Retention · Invites, follow-ups and
 * imports · Renewal contact — each its settings as they stand and **Change**,
 * which opens the group in a sheet; two columns from 1024 px.
 */
export function ConsoleSettings() {
  const query = useConsoleSettings();
  const data = query.data;

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.places.settings} subtitle={data ? changedLine(data) : words.settingsSubtitle} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {data ? (
          <div className="grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-2">
            {GROUPS.map((group) => (
              <SettingsGroup key={group} group={group} settings={data.settings} />
            ))}
          </div>
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="CONSOLE_SETTINGS_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={5} />
          </section>
        )}
      </div>
    </>
  );
}

/** One group: its settings as they stand, and Change to open them in a sheet (D378). */
function SettingsGroup({ group, settings }: { group: PlatformSettingGroup; settings: PlatformSettings }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const title = words.settingGroups[group];
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title}>
        <Button
          label={words.change}
          aria-label={words.changeGroup(title)}
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        />
      </SectionHeading>
      <DetailList
        details={PLATFORM_SETTING_GROUPS[group].map((key) => ({
          label: words.settingNames[key],
          value: showSetting(key, settings),
        }))}
      />
      <SettingsSheet group={group} settings={settings} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
