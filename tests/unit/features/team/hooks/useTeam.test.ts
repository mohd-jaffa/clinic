import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "m-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useTeam } = await import("@/features/team/hooks/useTeam");

describe("useTeam", () => {
  it("reads the whole team from its route", () => {
    const { result } = renderHook(() => useTeam());
    expect(useApiQuery).toHaveBeenCalledWith("/api/team");
    expect(result.current.data).toEqual([{ id: "m-1" }]);
  });
});
