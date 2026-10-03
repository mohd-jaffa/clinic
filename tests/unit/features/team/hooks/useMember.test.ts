import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: { id: "m-2" } })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useMember } = await import("@/features/team/hooks/useMember");

describe("useMember", () => {
  it("reads one member from their own route", () => {
    const { result } = renderHook(() => useMember("m-2"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/team/m-2");
    expect(result.current.data).toEqual({ id: "m-2" });
  });
});
