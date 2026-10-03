import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "e-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useExpenseCategories } = await import("@/features/clinic/hooks/useExpenseCategories");

describe("useExpenseCategories", () => {
  it("reads the whole list from its route, archived entries too", () => {
    const { result } = renderHook(() => useExpenseCategories());
    expect(useApiQuery).toHaveBeenCalledWith("/api/expense-categories");
    expect(result.current.data).toEqual([{ id: "e-1" }]);
  });
});
