import { describe, expect, it } from "vitest";

import { readIdempotencyKey } from "@/lib/api/idempotency";

const request = (key?: string) =>
  new Request("http://app.test/api/appointments", {
    method: "POST",
    headers: key === undefined ? {} : { "Idempotency-Key": key },
  });

describe("readIdempotencyKey", () => {
  it("reads the key a write was sent with, in one case", () => {
    expect(readIdempotencyKey(request(" 0D9F4C1E-2B3A-4C5D-8E6F-7A8B9C0D1E2F "))).toBe(
      "0d9f4c1e-2b3a-4c5d-8e6f-7a8b9c0d1e2f",
    );
  });

  it("refuses a write sent without one, or with something that is not one", () => {
    for (const key of [undefined, "", "abc", "0d9f4c1e2b3a4c5d8e6f7a8b9c0d1e2f"]) {
      expect(() => readIdempotencyKey(request(key))).toThrow(
        expect.objectContaining({ code: "IDEMPOTENCY_KEY_REQUIRED", httpStatus: 400 }),
      );
    }
  });
});
