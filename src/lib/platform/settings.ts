import type { SupabaseClient } from "@supabase/supabase-js";

import { PLATFORM_SETTING_COLUMNS, type PlatformSettingKey, type PlatformSettings } from "@/constants/platform";
import { fromPostgrestError } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/** The row as the database holds it: one column per setting (0004_platform_settings). */
export type PlatformSettingsRow = Record<string, unknown>;

/** The live settings out of their row, in the app's own names. */
export function toPlatformSettings(row: PlatformSettingsRow): PlatformSettings {
  const settings = {} as Record<PlatformSettingKey, unknown>;
  for (const [key, column] of Object.entries(PLATFORM_SETTING_COLUMNS) as [PlatformSettingKey, string][]) {
    settings[key] = row[column] ?? null;
  }
  return settings as unknown as PlatformSettings;
}

/**
 * The live platform settings (plan §6, AGENTS.md §10): what the DEV last saved,
 * never a default from code. Read as the server, because no clinic user may
 * read the row; whatever a clinic is shown of it (prices, the renewal
 * contact) reaches it through the API.
 */
export async function getPlatformSettings(
  admin: SupabaseClient = createSupabaseServiceRoleClient(),
): Promise<PlatformSettings> {
  const columns = Object.values(PLATFORM_SETTING_COLUMNS).join(", ");
  const { data, error } = await admin.from("platform_settings").select(columns).single();
  if (error) throw fromPostgrestError(error);
  return toPlatformSettings(data as unknown as PlatformSettingsRow);
}

/** A change to some settings, by their column names, as update_platform_settings takes it. */
export function toSettingsColumns(changes: Partial<PlatformSettings>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes) as [PlatformSettingKey, unknown][]) {
    if (value !== undefined) columns[PLATFORM_SETTING_COLUMNS[key]] = value;
  }
  return columns;
}

/**
 * Saves the DEV's changes (plan §6): through `update_platform_settings`, with
 * the DEV's own client, so the database checks the role and the bounds itself
 * and writes the platform audit row. Answers with every setting as saved.
 */
export async function updatePlatformSettings(
  developer: SupabaseClient,
  changes: Partial<PlatformSettings>,
  requestId: string,
): Promise<PlatformSettings> {
  const { data, error } = await developer.rpc("update_platform_settings", {
    p_changes: toSettingsColumns(changes),
    p_request_id: requestId,
  });
  if (error) throw fromPostgrestError(error);
  return toPlatformSettings(data as PlatformSettingsRow);
}
