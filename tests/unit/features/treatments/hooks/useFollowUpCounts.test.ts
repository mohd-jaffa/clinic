import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useFollowUpCounts } = await import("@/features/treatments/hooks/useFollowUpCounts");

describe("useFollowUpCounts (plan §14.3)", () => {
  it("reads how many each tab holds", () => {
    renderHook(() => useFollowUpCounts());
    expect(useApiQuery).toHaveBeenCalledWith("/api/follow-ups/counts");
  });
});
