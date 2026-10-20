import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useBills } = await import("@/features/billing/hooks/useBills");

describe("useBills (plan §15.4; D320)", () => {
  it("asks for the bills of some days, every state or one", () => {
    const days = { from: "2026-10-01", to: "2026-10-19" };
    renderHook(() => useBills(days));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/bills?from=2026-10-01&to=2026-10-19");
    renderHook(() => useBills(days, "UNPAID"));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/bills?from=2026-10-01&to=2026-10-19&state=UNPAID");
  });
});
