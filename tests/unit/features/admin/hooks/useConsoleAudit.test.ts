import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useConsoleAudit } = await import("@/features/admin/hooks/useConsoleAudit");

describe("useConsoleAudit (plan §20.7)", () => {
  it("asks for a page of the platform audit", () => {
    renderHook(() => useConsoleAudit());
    expect(useApiPages).toHaveBeenCalledWith("/api/admin/audit");
  });
});
