import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useConsoleAccounts } = await import("@/features/admin/hooks/useConsoleAccounts");

describe("useConsoleAccounts (plan §20.5)", () => {
  it("asks for a page of the accounts, searched", () => {
    renderHook(() => useConsoleAccounts("asha"));
    expect(useApiPages).toHaveBeenCalledWith("/api/admin/accounts?search=asha", { list: "accounts" });
  });
});
