import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { usePatientSummary } = await import("@/features/patients/hooks/usePatientSummary");

describe("usePatientSummary", () => {
  it("reads where the patient stands", () => {
    renderHook(() => usePatientSummary("p-1"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/patients/p-1/summary");
  });
});
