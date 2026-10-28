import { UI_TEXT } from "@/constants/messages";
import { PLATFORM_SETTING_COLUMNS, type PlatformSettingKey } from "@/constants/platform";
import { EXTENSION_KIND_LABELS, type ExtensionKind } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

import type { ConsoleAuditEntry } from "./types";

const { console: words } = UI_TEXT;

/** Each setting by its column, as `update_platform_settings` records what it changed (0004). */
const SETTING_OF_COLUMN = Object.fromEntries(
  Object.entries(PLATFORM_SETTING_COLUMNS).map(([key, column]) => [column, key as PlatformSettingKey]),
) as Record<string, PlatformSettingKey>;

const MONEY_SETTINGS: readonly PlatformSettingKey[] = ["monthlyPricePaise", "yearlyPricePaise"];

/** A setting's value as a person reads it: a price in rupees, a list of days, nothing as a dash. */
function settingValue(key: PlatformSettingKey, value: unknown): string {
  if (value === null || value === undefined) return words.unset;
  if (MONEY_SETTINGS.includes(key)) return formatPaise(value as number);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

type Change = { from: unknown; to: unknown };

/** What an extension did (0005): its kind, the last day it moved from and to, and what was paid. */
function extensionLine(changes: Record<string, unknown>): string {
  const lastDay = changes.valid_until as Change;
  const amount = changes.amount_paise as number;
  return [
    EXTENSION_KIND_LABELS[changes.kind as ExtensionKind],
    words.changed(formatDate(lastDay.from as string), formatDate(lastDay.to as string)),
    amount > 0 ? formatPaise(amount) : UI_TEXT.plan.noCharge,
  ].join(" · ");
}

/** What a settings change did (0004): each setting by name, from and to. */
function settingsLine(changes: Record<string, unknown>): string {
  return Object.entries(changes)
    .map(([column, change]) => {
      const key = SETTING_OF_COLUMN[column];
      const { from, to } = change as Change;
      return `${words.settingNames[key]} ${words.changed(settingValue(key, from), settingValue(key, to))}`;
    })
    .join(" · ");
}

/**
 * One of the console's own actions, as the Audit says it (plan §20.7): a
 * plan extended — for which clinic, its last day moved from and to, what
 * was paid — or the settings changed, each by name. Anything else by its
 * record and action.
 */
export function describeAudit(entry: ConsoleAuditEntry): { title: string; line?: string } {
  if (entry.entityType === "subscription_payments" && entry.changes) {
    return { title: words.planExtended(entry.clinicName ?? words.goneClinic), line: extensionLine(entry.changes) };
  }
  if (entry.entityType === "platform_settings" && entry.changes) {
    return { title: words.settingsChanged, line: settingsLine(entry.changes) };
  }
  return { title: words.otherAction(entry.entityType, entry.action) };
}
