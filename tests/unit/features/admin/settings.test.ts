import { describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS, type PlatformSettings } from "@/constants/platform";
import {
  askLine,
  changedSettings,
  changesLine,
  settingHint,
  settingText,
  showSetting,
} from "@/features/admin/settings";

/** The defaults, with a renewal contact set. */
const now: PlatformSettings = {
  ...PLATFORM_SETTING_DEFAULTS,
  renewalContactName: "Jaffa",
  renewalContactPhone: "+919845012345",
};

describe("showSetting (plan §20.4)", () => {
  it("says each setting as a person reads it", () => {
    expect(showSetting("trialDays", now)).toBe("30 days");
    expect(showSetting("graceDays", { ...now, graceDays: 1 })).toBe("1 day");
    expect(showSetting("monthlyPricePaise", now)).toBe("₹300");
    expect(showSetting("maxImportRows", now)).toBe("10,000 rows");
    expect(showSetting("expiryNoticeDays", now)).toBe("7 and 1 days before");
    expect(showSetting("expiryNoticeDays", { ...now, expiryNoticeDays: [14, 7, 1] })).toBe("14, 7 and 1 days before");
    expect(showSetting("expiryNoticeDays", { ...now, expiryNoticeDays: [1] })).toBe("1 day before");
    expect(showSetting("expiryNoticeDays", { ...now, expiryNoticeDays: [3] })).toBe("3 days before");
    expect(showSetting("expiryNoticeDays", { ...now, expiryNoticeDays: [] })).toBe("None");
    expect(showSetting("renewalContactName", now)).toBe("Jaffa");
    expect(showSetting("renewalContactPhone", now)).toBe("+91 98450 12345");
    expect(showSetting("renewalContactPhone", PLATFORM_SETTING_DEFAULTS)).toBe("Not set");
    expect(showSetting("renewalUpiId", now)).toBe("Not set");
  });
});

describe("settingText", () => {
  it("starts each field as it would be typed", () => {
    expect(settingText("trialDays", now)).toBe("30");
    expect(settingText("yearlyPricePaise", now)).toBe("3000");
    expect(settingText("expiryNoticeDays", now)).toBe("7, 1");
    expect(settingText("renewalContactPhone", now)).toBe("98450 12345");
    expect(settingText("renewalContactPhone", PLATFORM_SETTING_DEFAULTS)).toBe("");
    expect(settingText("renewalContactEmail", now)).toBe("");
    expect(settingText("renewalContactName", now)).toBe("Jaffa");
  });
});

describe("settingHint (plan §20.4)", () => {
  it("says each setting's default and bounds; the contact, what it is for", () => {
    expect(settingHint("trialDays")).toBe("Default 30 · 0 – 365 days");
    expect(settingHint("monthlyPricePaise")).toBe("Default ₹300 · up to ₹1,00,000");
    expect(settingHint("maxImportRows")).toBe("Default 10,000 · 100 – 50,000 rows");
    expect(settingHint("expiryNoticeDays")).toBe(
      "Default 7, 1 · up to 5 days, each 1 – 60, with commas between. Empty sends none.",
    );
    expect(settingHint("renewalUpiId")).toBe("Shown on every owner’s Plan screen; empty hides it.");
  });
});

describe("what a save changes, and says (D381)", () => {
  const saved = { trialDays: 45, monthlyPricePaise: 35_000, yearlyPricePaise: 300_000, expiryNoticeDays: [7, 1] };

  it("finds only what would change", () => {
    expect(changedSettings(now, saved)).toEqual(["trialDays", "monthlyPricePaise"]);
    expect(changedSettings(now, { graceDays: 7, renewalContactName: "Jaffa" })).toEqual([]);
    expect(changedSettings(now, { expiryNoticeDays: [14, 7, 1] })).toEqual(["expiryNoticeDays"]);
  });

  it("says each change, then when they take effect, each once", () => {
    const keys = changedSettings(now, { ...saved, yearlyPricePaise: 350_000 });
    expect(changesLine(keys, now, { ...saved, yearlyPricePaise: 350_000 })).toBe(
      "Trial days 30 → 45. Monthly price ₹300 → ₹350. Yearly price ₹3,000 → ₹3,500.",
    );
    expect(askLine(keys, now, { ...saved, yearlyPricePaise: 350_000 })).toBe(
      "Trial days 30 → 45. Monthly price ₹300 → ₹350. Yearly price ₹3,000 → ₹3,500. " +
        "Applies to clinics that sign up from now. " +
        "Fills in the next extension and every Plan screen; recorded ones keep theirs.",
    );
  });

  it("says nothing of when for a change it does not matter for", () => {
    expect(askLine(["deletionCoolingDays"], now, { deletionCoolingDays: 14 })).toBe(
      "Deletion cooling-off (days) 7 → 14.",
    );
    expect(askLine(["renewalContactName"], now, { renewalContactName: null })).toBe(
      "Renewal contact Jaffa → —. Shows on every owner’s Plan screen at once.",
    );
  });
});
