import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useFollowUps } = await import("@/features/treatments/hooks/useFollowUps");

describe("useFollowUps (plan §14.3)", () => {
  it("asks for a tab a page at a time, each tab its own list (D191)", () => {
    renderHook(() => useFollowUps("LAPSED"));
    expect(useApiPages).toHaveBeenCalledWith("/api/follow-ups?tab=LAPSED", { list: "LAPSED" });
  });
});
