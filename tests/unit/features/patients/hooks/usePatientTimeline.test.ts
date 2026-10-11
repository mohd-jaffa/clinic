import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiPages } = vi.hoisted(() => ({ useApiPages: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { usePatientTimeline } = await import("@/features/patients/hooks/usePatientTimeline");

describe("usePatientTimeline", () => {
  it("reads the patient's history a page at a time", () => {
    renderHook(() => usePatientTimeline("p-1"));
    expect(useApiPages).toHaveBeenCalledWith("/api/patients/p-1/timeline");
  });
});
