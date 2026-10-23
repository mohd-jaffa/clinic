import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useExpenses } = await import("@/features/expenses/hooks/useExpenses");

const october = { from: "2026-10-01", to: "2026-10-31" };

describe("useExpenses (plan §16; D330, D331)", () => {
  it("asks for a month's expenses — one category's, or the archived once shown — each its own list", () => {
    renderHook(() => useExpenses(october));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/expenses?from=2026-10-01&to=2026-10-31", {
      list: "2026-10-01::false",
    });
    renderHook(() => useExpenses(october, { categoryId: "c-1", archived: true }));
    expect(useApiPages).toHaveBeenLastCalledWith(
      "/api/expenses?from=2026-10-01&to=2026-10-31&categoryId=c-1&archived=true",
      { list: "2026-10-01:c-1:true" },
    );
    renderHook(() => useExpenses(october, { archived: true, enabled: false }));
    expect(useApiPages).toHaveBeenLastCalledWith(null, { list: "2026-10-01::true" });
  });
});
