import { describe, expect, it } from "vitest";

import { newRequestKey, requestKeys } from "@/lib/api/request-key";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newRequestKey", () => {
  it("makes a version-4 UUID, a new one each time", () => {
    const keys = new Set(Array.from({ length: 50 }, newRequestKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(UUID_V4);
  });
});

describe("requestKeys", () => {
  it("sends the same request again with the same key — a double tap, or Try again", () => {
    const keys = requestKeys();
    expect(keys.keyFor({ amount: 500 })).toBe(keys.keyFor({ amount: 500 }));
  });

  it("gives a changed request a new key", () => {
    const keys = requestKeys();
    expect(keys.keyFor({ amount: 500 })).not.toBe(keys.keyFor({ amount: 600 }));
  });

  it("gives the next request a new key once the last succeeded, even if it is the same", () => {
    const keys = requestKeys();
    const first = keys.keyFor({ amount: 500 });
    keys.settle();
    expect(keys.keyFor({ amount: 500 })).not.toBe(first);
  });
});
