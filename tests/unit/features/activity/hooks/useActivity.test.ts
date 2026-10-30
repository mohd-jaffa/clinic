import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useActivity } = await import("@/features/activity/hooks/useActivity");

describe("useActivity (plan §19; D388)", () => {
  it("asks for a page at a time, each choice its own list", () => {
    renderHook(() => useActivity(null, null));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/activity", { list: "ALL:ALL" });
    renderHook(() => useActivity("u-1", "TEAM"));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/activity?person=u-1&kind=TEAM", { list: "u-1:TEAM" });
  });
});
