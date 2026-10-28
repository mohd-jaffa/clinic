import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useConsoleClinic } = await import("@/features/admin/hooks/useConsoleClinic");

describe("useConsoleClinic (plan §20.3)", () => {
  it("asks for one clinic", () => {
    renderHook(() => useConsoleClinic("c-1"));
    expect(useApiQuery).toHaveBeenCalledWith("/api/admin/clinics/c-1");
  });
});
