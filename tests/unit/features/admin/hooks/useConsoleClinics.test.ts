import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useConsoleClinics } = await import("@/features/admin/hooks/useConsoleClinics");

describe("useConsoleClinics (plan §20.2)", () => {
  it("asks for a page of the clinics searched and filtered, each filter its own list", () => {
    renderHook(() => useConsoleClinics("Smile", "TRIAL"));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/admin/clinics?search=Smile&filter=TRIAL", { list: "TRIAL" });
    renderHook(() => useConsoleClinics("", null));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/admin/clinics", { list: "ALL" });
  });
});
