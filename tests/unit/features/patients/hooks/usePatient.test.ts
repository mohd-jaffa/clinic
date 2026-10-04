import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { usePatient } = await import("@/features/patients/hooks/usePatient");

describe("usePatient (plan §10.3)", () => {
  it("reads one patient by their id", () => {
    renderHook(() => usePatient("p-1"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/patients/p-1");
  });
});
