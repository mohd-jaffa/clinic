import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useOutstanding } = await import("@/features/billing/hooks/useOutstanding");

describe("useOutstanding (plan §15.4; D321)", () => {
  it("asks for who owes, a page at a time", () => {
    renderHook(() => useOutstanding());
    expect(useApiPages).toHaveBeenLastCalledWith("/api/outstanding");
  });
});
