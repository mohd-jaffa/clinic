import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useMonthlyReport } = await import("@/features/reports/hooks/useMonthlyReport");

describe("useMonthlyReport (plan §18)", () => {
  it("asks for the report, keeping the last one on screen while the next loads", () => {
    renderHook(() => useMonthlyReport("2026-10-01"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/reports/monthly?month=2026-10-01", { keepPreviousData: true });
  });
});
