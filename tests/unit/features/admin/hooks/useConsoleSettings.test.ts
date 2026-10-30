import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useConsoleSettings } = await import("@/features/admin/hooks/useConsoleSettings");

describe("useConsoleSettings (plan §20.4)", () => {
  it("asks for the platform settings", () => {
    renderHook(() => useConsoleSettings());
    expect(useApiQuery).toHaveBeenCalledWith("/api/admin/settings");
  });
});
