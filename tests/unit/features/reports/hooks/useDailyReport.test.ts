import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useDailyReport } = await import("@/features/reports/hooks/useDailyReport");

describe("useDailyReport (plan §18)", () => {
  it("asks for the report, keeping the last one on screen while the next loads", () => {
    renderHook(() => useDailyReport("2026-10-27"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/reports/daily?day=2026-10-27", { keepPreviousData: true });
  });
});
