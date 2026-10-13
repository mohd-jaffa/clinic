import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";

import { useSeeded } from "@/lib/query/useSeeded";

function withCache(cache: Map<string, unknown>, fallback: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => cache as never, fallback }}>{children}</SWRConfig>;
  };
}

const seeded = (key: string | null, cache: Map<string, unknown>, fallback: Record<string, unknown>) =>
  renderHook(() => useSeeded(key), { wrapper: withCache(cache, fallback) }).result.current;

describe("useSeeded", () => {
  it("is true while the page's own data is what is shown, put in the cache or not yet", () => {
    const patients: unknown[] = [];
    expect(seeded("/api/patients", new Map(), { "/api/patients": patients })).toBe(true);
    expect(
      seeded("/api/patients", new Map([["/api/patients", { data: patients }]]), { "/api/patients": patients }),
    ).toBe(true);
  });

  it("is false once the browser has read the key itself, or when nothing was brought for it", () => {
    const read = new Map<string, unknown>([["/api/patients", { data: [{ id: "p" }] }]]);
    expect(seeded("/api/patients", read, { "/api/patients": [] })).toBe(false);
    expect(seeded("/api/appointments", new Map(), {})).toBe(false);
    expect(seeded(null, new Map(), {})).toBe(false);
  });
});
