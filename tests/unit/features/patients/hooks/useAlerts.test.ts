import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useAlerts } = await import("@/features/patients/hooks/useAlerts");

beforeEach(() => useApiQuery.mockClear());

describe("useAlerts (plan §10.4)", () => {
  it("reads a patient's alerts for someone who may", () => {
    renderHook(() => useAlerts("p-1", true));
    expect(useApiQuery).toHaveBeenCalledWith("/api/patients/p-1/alerts");
  });

  it("asks nothing for someone who may not", () => {
    renderHook(() => useAlerts("p-1", false));
    expect(useApiQuery).toHaveBeenCalledWith(null);
  });
});
