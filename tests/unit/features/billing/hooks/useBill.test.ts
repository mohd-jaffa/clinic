import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useBill } = await import("@/features/billing/hooks/useBill");

describe("useBill (plan §15.2, D314)", () => {
  it("reads the bill — and nothing for none", () => {
    renderHook(() => useBill("b-1"));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/bills/b-1");
    renderHook(() => useBill(null));
    expect(useApiQuery).toHaveBeenLastCalledWith(null);
  });
});
