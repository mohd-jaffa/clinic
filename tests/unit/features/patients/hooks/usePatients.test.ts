import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { usePatients } = await import("@/features/patients/hooks/usePatients");

describe("usePatients (plan §10.2, D98)", () => {
  it("asks for the list a page at a time, each as a POST", () => {
    renderHook(() => usePatients("Mehta", "ARCHIVED"));
    expect(useApiPages).toHaveBeenCalledWith("/api/patients/search?search=Mehta&tab=ARCHIVED", { post: true });
  });
});
