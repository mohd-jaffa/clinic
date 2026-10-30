/**
 * The platform settings' **defaults and bounds** (plan §6, D22) — never their
 * live values. The live row is `platform_settings`, which the DEV edits in the
 * developer console; the code reads it through `getPlatformSettings()`
 * (src/lib/platform/settings.ts) and the database reads it directly
 * (AGENTS.md §10).
 *
 * 0004_platform_settings seeds the row from these same defaults and bounds
 * every column by these same limits (0016 adds `max_import_rows`); tests/db
 * keeps the two equal.
 */

export interface PlatformSettings {
  trialDays: number;
  monthlyPricePaise: number;
  yearlyPricePaise: number;
  expiryWarningDays: number;
  graceDays: number;
  /** Days before a plan's last day an email is sent, one each (plan §22). */
  expiryNoticeDays: number[];
  auditKeepDays: number;
  errorLogKeepDays: number;
  inviteValidDays: number;
  followUpLapsedDays: number;
  deletionCoolingDays: number;
  /** How many rows one patient import may hold (plan §10.5, D128). */
  maxImportRows: number;
  /** Who a clinic contacts to renew (plan §7.5); each is hidden while unset. */
  renewalContactName: string | null;
  renewalContactPhone: string | null;
  renewalContactEmail: string | null;
  renewalUpiId: string | null;
  /** The platform's own name and address, on plan receipts (D58). */
  businessName: string | null;
  businessAddress: string | null;
}

export type PlatformSettingKey = keyof PlatformSettings;

/** Each setting's column in `platform_settings`. */
export const PLATFORM_SETTING_COLUMNS: Record<PlatformSettingKey, string> = {
  trialDays: "trial_days",
  monthlyPricePaise: "monthly_price_paise",
  yearlyPricePaise: "yearly_price_paise",
  expiryWarningDays: "expiry_warning_days",
  graceDays: "grace_days",
  expiryNoticeDays: "expiry_notice_days",
  auditKeepDays: "audit_keep_days",
  errorLogKeepDays: "error_log_keep_days",
  inviteValidDays: "invite_valid_days",
  followUpLapsedDays: "follow_up_lapsed_days",
  deletionCoolingDays: "deletion_cooling_days",
  maxImportRows: "max_import_rows",
  renewalContactName: "renewal_contact_name",
  renewalContactPhone: "renewal_contact_phone",
  renewalContactEmail: "renewal_contact_email",
  renewalUpiId: "renewal_upi_id",
  businessName: "business_name",
  businessAddress: "business_address",
};

/** What a new platform starts with (plan §6): the user's own numbers (D11, D12, D14). */
export const PLATFORM_SETTING_DEFAULTS: PlatformSettings = {
  trialDays: 30,
  monthlyPricePaise: 30_000,
  yearlyPricePaise: 300_000,
  expiryWarningDays: 7,
  graceDays: 7,
  expiryNoticeDays: [7, 1],
  auditKeepDays: 30,
  errorLogKeepDays: 7,
  inviteValidDays: 7,
  followUpLapsedDays: 30,
  deletionCoolingDays: 7,
  maxImportRows: 10_000,
  renewalContactName: null,
  renewalContactPhone: null,
  renewalContactEmail: null,
  renewalUpiId: null,
  businessName: null,
  businessAddress: null,
};

/** A whole number a setting may be set to, inclusive; for a list of them, also how many. */
export interface NumberBound {
  min: number;
  max: number;
  maxCount?: number;
}

/** What each number may be set to (plan §6). The text settings are bounded by TEXT_LIMITS. */
export const PLATFORM_SETTING_BOUNDS = {
  trialDays: { min: 0, max: 365 },
  monthlyPricePaise: { min: 0, max: 10_000_000 },
  yearlyPricePaise: { min: 0, max: 100_000_000 },
  expiryWarningDays: { min: 0, max: 60 },
  graceDays: { min: 0, max: 60 },
  /** Each day in the list; and at most `maxCount` of them. */
  expiryNoticeDays: { min: 1, max: 60, maxCount: 5 },
  auditKeepDays: { min: 7, max: 3650 },
  errorLogKeepDays: { min: 1, max: 365 },
  inviteValidDays: { min: 1, max: 30 },
  followUpLapsedDays: { min: 7, max: 365 },
  deletionCoolingDays: { min: 0, max: 90 },
  maxImportRows: { min: 100, max: 50_000 },
} as const satisfies Partial<Record<PlatformSettingKey, NumberBound>>;

/**
 * How the console's Settings screen groups them (plan §20.4; D378, D379),
 * each group changed in a sheet of its own; the business name and address
 * with the plan receipts that print them (R11.8).
 */
export const PLATFORM_SETTING_GROUPS = {
  trialAndPricing: ["trialDays", "monthlyPricePaise", "yearlyPricePaise"],
  expiry: ["expiryWarningDays", "graceDays", "expiryNoticeDays"],
  retention: ["auditKeepDays", "errorLogKeepDays", "deletionCoolingDays"],
  invitesAndImports: ["inviteValidDays", "followUpLapsedDays", "maxImportRows"],
  renewalContact: ["renewalContactName", "renewalContactPhone", "renewalContactEmail", "renewalUpiId"],
  businessDetails: ["businessName", "businessAddress"],
} as const satisfies Record<string, readonly PlatformSettingKey[]>;

export type PlatformSettingGroup = keyof typeof PLATFORM_SETTING_GROUPS;

/** A setting the Settings screen changes: every one. */
export type EditableSettingKey = (typeof PLATFORM_SETTING_GROUPS)[PlatformSettingGroup][number];
