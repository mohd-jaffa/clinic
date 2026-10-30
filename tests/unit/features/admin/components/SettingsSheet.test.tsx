import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import type { PlatformSettingGroup } from "@/constants/platform";
import { aConsoleSettings } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { saveSettings: vi.fn() } }));
vi.mock("@/features/admin/api.client", () => ({ ConsoleClient: client }));

const { SettingsSheet } = await import("@/features/admin/components/SettingsSheet");

const { settings } = aConsoleSettings();
const onClose = vi.fn();
const draw = (group: PlatformSettingGroup, title: string) => {
  render(<SettingsSheet group={group} settings={settings} open onClose={onClose} />, { wrapper: Providers });
  return screen.getByRole("dialog", { name: title });
};
const field = (sheet: HTMLElement, name: RegExp) => within(sheet).getByRole("textbox", { name });
const save = (sheet: HTMLElement) => userEvent.click(within(sheet).getByRole("button", { name: "Save" }));

beforeEach(() => {
  vi.clearAllMocks();
  client.saveSettings.mockImplementation(async (changes: Record<string, unknown>) => ({
    ...settings,
    ...("trialDays" in changes ? { trialDays: 45 } : {}),
    ...("expiryNoticeDays" in changes ? { expiryNoticeDays: [14, 7, 1] } : {}),
  }));
});

describe("SettingsSheet (plan §20.4; D378 – D381)", () => {
  it("starts each setting as it stands, hinting its default and bounds, and saves what changed after asking", async () => {
    const sheet = draw("trialAndPricing", "Trial and pricing");
    expect(field(sheet, /^Trial days/)).toHaveValue("30");
    expect(field(sheet, /^Trial days/)).toHaveAccessibleDescription("Default 30 · 0 – 365 days");
    expect(field(sheet, /^Monthly price/)).toHaveValue("300");
    expect(field(sheet, /^Yearly price/)).toHaveAccessibleDescription("₹ Default ₹3,000 · up to ₹10,00,000");

    await userEvent.clear(field(sheet, /^Trial days/));
    await userEvent.type(field(sheet, /^Trial days/), "45");
    await save(sheet);
    const card = await screen.findByRole("alertdialog", { name: "Save these settings?" });
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.saveSettings).toHaveBeenCalledWith({ trialDays: "45" }));
    expect(onClose).toHaveBeenCalled();
    // Kept as saved, for the next time it opens.
    expect(field(sheet, /^Trial days/)).toHaveValue("45");
  });

  it("refuses a setting out of its bounds in its own words", async () => {
    const sheet = draw("expiry", "Expiry");
    await userEvent.clear(field(sheet, /^Grace days/));
    await userEvent.type(field(sheet, /^Grace days/), "61");
    await save(sheet);
    expect(await within(sheet).findByText("Grace days must be from 0 to 60.")).toBeInTheDocument();
    expect(client.saveSettings).not.toHaveBeenCalled();
  });

  it("takes the email days as a list, and closes untouched when nothing changed", async () => {
    const sheet = draw("expiry", "Expiry");
    expect(field(sheet, /^Expiry email days/)).toHaveValue("7, 1");
    await save(sheet);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.clear(field(sheet, /^Expiry email days/));
    await userEvent.type(field(sheet, /^Expiry email days/), "1, 7, 14");
    await save(sheet);
    const card = await screen.findByRole("alertdialog");
    expect(within(card).getByText(/^Expiry email days 7, 1 → 14, 7, 1\./)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.saveSettings).toHaveBeenCalledWith({ expiryNoticeDays: "1, 7, 14" }));
  });

  it("gives each part of the renewal contact its own field, emptied to hide it", async () => {
    const sheet = draw("renewalContact", "Renewal contact");
    expect(field(sheet, /^Renewal contact/)).toHaveAttribute("maxlength", String(TEXT_LIMITS.personName));
    expect(field(sheet, /^Renewal mobile/)).toHaveValue("98450 12345");
    expect(field(sheet, /^Renewal email/)).toHaveAttribute("type", "email");
    expect(field(sheet, /^UPI id/)).toHaveAttribute("maxlength", String(TEXT_LIMITS.upiId));
    await userEvent.clear(field(sheet, /^UPI id/));
    await save(sheet);
    const card = await screen.findByRole("alertdialog");
    expect(within(card).getByText(/^UPI id clinicdesk@okaxis → —\./)).toBeInTheDocument();
  });

  it("gives the retention and import settings their bounds", () => {
    const retention = draw("retention", "Retention");
    expect(field(retention, /^Audit kept for/)).toHaveAccessibleDescription("Default 30 · 7 – 3650 days");
  });

  it("gives the import rows theirs", () => {
    const imports = draw("invitesAndImports", "Invites, follow-ups and imports");
    expect(field(imports, /^Rows per import/)).toHaveAccessibleDescription("Default 10,000 · 100 – 50,000 rows");
  });
});
