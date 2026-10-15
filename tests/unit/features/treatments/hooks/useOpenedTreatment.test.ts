import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOpenedTreatment } from "@/features/treatments/hooks/useOpenedTreatment";
import type { Treatment } from "@/features/treatments/types";
import { aTreatment } from "@tests/support/treatments";

describe("useOpenedTreatment (D256, D261)", () => {
  it("opens one, follows it as the list is read again, and keeps it once it leaves the list or closes", () => {
    let list: Treatment[] = [aTreatment()];
    const { result, rerender } = renderHook(() => useOpenedTreatment(list));
    expect(result.current).toMatchObject({ treatment: null, open: false });
    act(() => result.current.show(aTreatment()));
    expect(result.current).toMatchObject({ treatment: { status: "IN_PROGRESS" }, open: true });
    list = [aTreatment({ status: "ON_HOLD" })];
    rerender();
    expect(result.current.treatment?.status).toBe("ON_HOLD");
    list = [];
    rerender();
    expect(result.current.treatment?.status).toBe("IN_PROGRESS");
    act(() => result.current.close());
    expect(result.current).toMatchObject({ treatment: { id: "t-1" }, open: false });
  });
});
