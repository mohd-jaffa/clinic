import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useExpenseTotals } = await import("@/features/expenses/hooks/useExpenseTotals");

describe("useExpenseTotals (plan §16; D330)", () => {
  it("asks for a month's totals", () => {
    renderHook(() => useExpenseTotals({ from: "2026-10-01", to: "2026-10-31" }));
    expect(useApiQuery).toHaveBeenCalledWith("/api/expenses/summary?from=2026-10-01&to=2026-10-31");
  });
});
