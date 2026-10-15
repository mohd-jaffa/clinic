import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useTemplates } = await import("@/features/prescriptions/hooks/useTemplates");

beforeEach(() => vi.clearAllMocks());

describe("useTemplates (D241, D242)", () => {
  it("reads a doctor's templates, and nothing until there is a doctor to ask for", () => {
    const { rerender } = renderHook(({ doctorId }) => useTemplates(doctorId), {
      initialProps: { doctorId: null as string | null },
    });
    expect(useApiQuery).toHaveBeenLastCalledWith(null);
    rerender({ doctorId: "d-1" });
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/prescription-templates?doctorId=d-1");
  });
});
