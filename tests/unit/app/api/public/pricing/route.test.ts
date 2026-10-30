import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/errors";
import { answerOf, apiRequest } from "@tests/support/routes";

const { getPublicPricing } = vi.hoisted(() => ({ getPublicPricing: vi.fn() }));
vi.mock("@/lib/platform/pricing", () => ({ getPublicPricing }));

const { GET } = await import("@/app/api/public/pricing/route");

const get = async () => answerOf(await GET(apiRequest("/api/public/pricing", { method: "GET" })));

const pricing = {
  trialDays: 30,
  monthlyPaise: 30_000,
  yearlyPaise: 300_000,
  contact: { name: null, phone: null, email: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPricing.mockResolvedValue(pricing);
});

describe("GET /api/public/pricing (plan §21, §30)", () => {
  it("answers anyone, signed in or not, with the live trial, prices and contact", async () => {
    expect(await get()).toEqual({ status: 200, body: { success: true, data: pricing } });
  });

  it("says a failure in the envelope", async () => {
    getPublicPricing.mockRejectedValue(notFoundError("NOT_FOUND"));
    expect(await get()).toMatchObject({ status: 404, body: { success: false } });
  });
});
