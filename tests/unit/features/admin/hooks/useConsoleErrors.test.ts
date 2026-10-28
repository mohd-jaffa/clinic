import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useConsoleErrors } = await import("@/features/admin/hooks/useConsoleErrors");

describe("useConsoleErrors (plan §20.6)", () => {
  it("asks for a page of the error log", () => {
    renderHook(() => useConsoleErrors());
    expect(useApiPages).toHaveBeenCalledWith("/api/admin/logs");
  });
});
