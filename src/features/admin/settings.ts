import { UI_TEXT } from "@/constants/messages";
import {
  PLATFORM_SETTING_BOUNDS as BOUNDS,
  PLATFORM_SETTING_DEFAULTS as DEFAULTS,
  type EditableSettingKey,
  type PlatformSettings,
} from "@/constants/platform";
import { formatCount } from "@/lib/format/count";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText } from "@/lib/money";
import { formatPhoneDigits } from "@/lib/phone";
import type { PlatformSettingsPayload } from "@/lib/validation";

import { settingChange } from "./describe";

const { console: words } = UI_TEXT;

/**
 * The console's Settings screen (plan §6, §20.4; D378 – D381): how each
 * setting is shown, typed and hinted, and what a change to it says before
 * it is saved.
 */

/** How a setting is typed and read. */
export type SettingKind =
  "days" | "price" | "rows" | "daysBefore" | "name" | "mobile" | "email" | "upi" | "business" | "address";

export const SETTING_KINDS: Record<EditableSettingKey, SettingKind> = {
  trialDays: "days",
  monthlyPricePaise: "price",
  yearlyPricePaise: "price",
  expiryWarningDays: "days",
  graceDays: "days",
  expiryNoticeDays: "daysBefore",
  auditKeepDays: "days",
  errorLogKeepDays: "days",
  deletionCoolingDays: "days",
  inviteValidDays: "days",
  followUpLapsedDays: "days",
  maxImportRows: "rows",
  renewalContactName: "name",
  renewalContactPhone: "mobile",
  renewalContactEmail: "email",
  renewalUpiId: "upi",
  businessName: "business",
  businessAddress: "address",
};

/** When a change takes effect (plan §6; D381), for each setting it matters for. */
const EFFECTS: Partial<Record<EditableSettingKey, keyof typeof words.effects>> = {
  trialDays: "signUps",
  monthlyPricePaise: "prices",
  yearlyPricePaise: "prices",
  expiryWarningDays: "states",
  graceDays: "states",
  expiryNoticeDays: "notices",
  auditKeepDays: "purge",
  errorLogKeepDays: "purge",
  inviteValidDays: "invites",
  followUpLapsedDays: "followUps",
  maxImportRows: "imports",
  renewalContactName: "contact",
  renewalContactPhone: "contact",
  renewalContactEmail: "contact",
  renewalUpiId: "contact",
  businessName: "receipts",
  businessAddress: "receipts",
};

/** A setting as the screen shows it: "30 days", "₹300", "7 and 1 days before", or Not set. */
export function showSetting(key: EditableSettingKey, settings: PlatformSettings): string {
  const value = settings[key];
  switch (SETTING_KINDS[key]) {
    case "days":
      return words.days(value as number);
    case "price":
      return formatPaise(value as number);
    case "rows":
      return words.rows(formatCount(value as number));
    case "daysBefore":
      return words.daysBefore(value as number[]);
    case "mobile":
      return value ? `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(value as string)}` : words.notSet;
    case "address":
      return value ? (value as string).split("\n").join(", ") : words.notSet;
    default:
      return (value as string | null) ?? words.notSet;
  }
}

/** What a setting's field starts with: the value as it would be typed. */
export function settingText(key: EditableSettingKey, settings: PlatformSettings): string {
  const value = settings[key];
  switch (SETTING_KINDS[key]) {
    case "price":
      return paiseToText(value as number);
    case "daysBefore":
      return (value as number[]).join(", ");
    case "mobile":
      return value ? formatPhoneDigits(value as string) : "";
    default:
      return value === null ? "" : String(value);
  }
}

/** What a setting's field says under it (plan §20.4): its default and its bounds; for the contact, what it is for. */
export function settingHint(key: EditableSettingKey): string {
  switch (key) {
    case "monthlyPricePaise":
    case "yearlyPricePaise":
      return words.priceHint(formatPaise(DEFAULTS[key]), formatPaise(BOUNDS[key].max));
    case "maxImportRows":
      return words.rowsHint(formatCount(DEFAULTS[key]), formatCount(BOUNDS[key].min), formatCount(BOUNDS[key].max));
    case "expiryNoticeDays": {
      const bound = BOUNDS.expiryNoticeDays;
      return words.daysBeforeHint(DEFAULTS[key].join(", "), bound.maxCount, bound.min, bound.max);
    }
    case "renewalContactName":
    case "renewalContactPhone":
    case "renewalContactEmail":
    case "renewalUpiId":
      return words.contactHint;
    case "businessName":
    case "businessAddress":
      return words.businessHint;
    default:
      return words.daysHint(DEFAULTS[key], BOUNDS[key].min, BOUNDS[key].max);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The settings a save would change: those sent whose value is not what it is now. */
export function changedSettings(now: PlatformSettings, saved: PlatformSettingsPayload): EditableSettingKey[] {
  return (Object.keys(saved) as EditableSettingKey[]).filter(
    (key) => saved[key] !== undefined && !same(saved[key], now[key]),
  );
}

/** Each change by name, from and to: "Trial days 30 → 45. Monthly price ₹300 → ₹350." */
export function changesLine(keys: EditableSettingKey[], now: PlatformSettings, saved: PlatformSettingsPayload): string {
  return keys.map((key) => `${settingChange(key, now[key], saved[key])}.`).join(" ");
}

/** What the card asks with (D381): each change, then when they take effect — each said once. */
export function askLine(keys: EditableSettingKey[], now: PlatformSettings, saved: PlatformSettingsPayload): string {
  const effects = [...new Set(keys.flatMap((key) => (EFFECTS[key] ? [words.effects[EFFECTS[key]]] : [])))];
  return [changesLine(keys, now, saved), ...effects].join(" ");
}
