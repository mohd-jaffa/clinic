import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useBillStart } = await import("@/features/billing/hooks/useBillStart");

describe("useBillStart (plan §15.2, D313)", () => {
  it("reads where the bill starts — and nothing for no one yet", () => {
    renderHook(() => useBillStart({ visit: "v-1" }));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/bills/start?visit=v-1");
    renderHook(() => useBillStart(null));
    expect(useApiQuery).toHaveBeenLastCalledWith(null);
  });
});
