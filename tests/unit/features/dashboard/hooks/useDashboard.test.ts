import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useDashboard } = await import("@/features/dashboard/hooks/useDashboard");

describe("useDashboard (plan §17; D353)", () => {
  it("asks for Home, again every 15 s and on focus, as the queue does", () => {
    renderHook(() => useDashboard());
    expect(useApiQuery).toHaveBeenCalledWith("/api/dashboard", { refreshInterval: 15_000, revalidateOnFocus: true });
  });
});
