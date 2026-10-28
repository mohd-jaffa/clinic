import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { usePlan } = await import("@/features/subscription/hooks/usePlan");

describe("usePlan (plan §7.5)", () => {
  it("asks for the owner's plan", () => {
    renderHook(() => usePlan());
    expect(useApiQuery).toHaveBeenCalledWith("/api/subscription");
  });
});
