import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";

const { getPlatformSettings, captureError } = vi.hoisted(() => ({
  getPlatformSettings: vi.fn(),
  captureError: vi.fn(),
}));
vi.mock("@/lib/platform/settings", () => ({ getPlatformSettings }));
vi.mock("@/lib/audit/errorLog", () => ({ captureError }));

const { getPublicPricing, readPublicPricing, toPublicPricing } = await import("@/lib/platform/pricing");

const live = {
  ...PLATFORM_SETTING_DEFAULTS,
  trialDays: 14,
  monthlyPricePaise: 45_000,
  yearlyPricePaise: 450_000,
  renewalContactName: "Asha",
  renewalContactPhone: "+919876543210",
  renewalContactEmail: "asha@example.com",
  renewalUpiId: "asha@upi",
  businessName: "Asha Tech",
};

beforeEach(() => {
  vi.clearAllMocks();
  getPlatformSettings.mockResolvedValue(live);
});

describe("toPublicPricing (plan §21)", () => {
  it("tells the trial, the two prices and the contact — and nothing else of the row", () => {
    expect(toPublicPricing(live)).toEqual({
      trialDays: 14,
      monthlyPaise: 45_000,
      yearlyPaise: 450_000,
      contact: { name: "Asha", phone: "+919876543210", email: "asha@example.com" },
    });
  });
});

describe("getPublicPricing", () => {
  it("reads the live settings, never the defaults", async () => {
    await expect(getPublicPricing()).resolves.toMatchObject({ trialDays: 14, monthlyPaise: 45_000 });
    expect(getPlatformSettings).toHaveBeenCalledOnce();
  });
});

describe("readPublicPricing", () => {
  it("answers the same for the landing as it is drawn", async () => {
    await expect(readPublicPricing()).resolves.toMatchObject({ yearlyPaise: 450_000 });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("answers nothing when the settings cannot be read, with the failure logged", async () => {
    const failure = new Error("down");
    getPlatformSettings.mockRejectedValue(failure);
    await expect(readPublicPricing()).resolves.toBeNull();
    expect(captureError).toHaveBeenCalledWith({ message: "Could not read the prices for the landing", error: failure });
  });
});
