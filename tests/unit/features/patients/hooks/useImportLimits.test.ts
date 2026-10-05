import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useImportLimits } = await import("@/features/patients/hooks/useImportLimits");

describe("useImportLimits (D128)", () => {
  it("reads how many rows an import may hold", () => {
    renderHook(() => useImportLimits());
    expect(useApiQuery).toHaveBeenCalledWith("/api/patients/import");
  });
});
