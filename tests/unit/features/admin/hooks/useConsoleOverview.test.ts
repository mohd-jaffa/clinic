import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useConsoleOverview } = await import("@/features/admin/hooks/useConsoleOverview");

describe("useConsoleOverview (plan §20.1)", () => {
  it("asks for the Overview, again when the DEV comes back to it", () => {
    renderHook(() => useConsoleOverview());
    expect(useApiQuery).toHaveBeenCalledWith("/api/admin/overview", { revalidateOnFocus: true });
  });
});
