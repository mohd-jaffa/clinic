import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOpened } from "@/hooks/useOpened";

describe("useOpened", () => {
  it("opens a record, and keeps it once closed so its sheet has something to show as it goes", () => {
    const { result } = renderHook(() => useOpened<{ id: string }>());
    expect(result.current).toMatchObject({ item: null, open: false });
    act(() => result.current.show({ id: "pay-1" }));
    expect(result.current).toMatchObject({ item: { id: "pay-1" }, open: true });
    act(() => result.current.close());
    expect(result.current).toMatchObject({ item: { id: "pay-1" }, open: false });
  });
});
