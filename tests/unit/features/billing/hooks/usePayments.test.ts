import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { usePayments } = await import("@/features/billing/hooks/usePayments");

describe("usePayments (plan §15.4; D320)", () => {
  it("asks for the payments of some days", () => {
    renderHook(() => usePayments({ from: "2026-10-19", to: "2026-10-19" }));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/payments?from=2026-10-19&to=2026-10-19");
  });
});
