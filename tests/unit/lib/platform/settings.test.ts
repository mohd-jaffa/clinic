import { describe, expect, it, vi } from "vitest";

import { PLATFORM_SETTING_COLUMNS, PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { fakeSupabase, postgrestError } from "@tests/support/supabase";

const { server } = vi.hoisted(() => ({ server: { client: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => server.client }));

const { getPlatformSettings, toPlatformSettings, toSettingsColumns, updatePlatformSettings } =
  await import("@/lib/platform/settings");

const row = Object.fromEntries(
  Object.entries(PLATFORM_SETTING_COLUMNS).map(([key, column]) => [
    column,
    PLATFORM_SETTING_DEFAULTS[key as keyof typeof PLATFORM_SETTING_DEFAULTS],
  ]),
);

describe("toPlatformSettings", () => {
  it("reads the row in the app's own names, a missing column as unset", () => {
    expect(toPlatformSettings(row)).toEqual(PLATFORM_SETTING_DEFAULTS);
    expect(toPlatformSettings({ trial_days: 45 })).toMatchObject({ trialDays: 45, graceDays: null });
  });
});

describe("getPlatformSettings", () => {
  it("reads the live row as the server, every column by name", async () => {
    const fake = fakeSupabase({ answer: () => ({ data: { ...row, grace_days: 14 } }) });
    server.client = fake.client;
    await expect(getPlatformSettings()).resolves.toMatchObject({ graceDays: 14 });
    expect(fake.find("platform_settings", "select", Object.values(PLATFORM_SETTING_COLUMNS).join(", "))).toBeDefined();
  });

  it("uses the client it is given, and says a failure as the app's own", async () => {
    const failing = fakeSupabase({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(getPlatformSettings(failing.client)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});

describe("toSettingsColumns", () => {
  it("names each change by its column, and leaves out what is not changing", () => {
    expect(toSettingsColumns({ graceDays: 14, renewalUpiId: null, trialDays: undefined })).toEqual({
      grace_days: 14,
      renewal_upi_id: null,
    });
  });
});

describe("updatePlatformSettings", () => {
  it("saves through update_platform_settings with the DEV's own client, answering every setting as saved", async () => {
    const developer = fakeSupabase({ rpc: () => ({ data: { ...row, grace_days: 14 } }) });
    await expect(updatePlatformSettings(developer.client, { graceDays: 14 }, "req_1")).resolves.toMatchObject({
      graceDays: 14,
    });
    expect(developer.rpcs).toEqual([
      { name: "update_platform_settings", args: { p_changes: { grace_days: 14 }, p_request_id: "req_1" } },
    ]);
  });

  it("says a refusal as the app's own: a bound broken, or someone not the DEV", async () => {
    const outOfBounds = fakeSupabase({ rpc: () => ({ error: postgrestError("23514") }) });
    await expect(updatePlatformSettings(outOfBounds.client, { graceDays: 61 }, "r")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const owner = fakeSupabase({ rpc: () => ({ error: postgrestError("42501") }) });
    await expect(updatePlatformSettings(owner.client, { graceDays: 1 }, "r")).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
