import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEntryEditor } from "@/features/clinic/hooks/useEntryEditor";

describe("useEntryEditor", () => {
  it("opens for a new entry, or for one to change, each with a form of its own", () => {
    const { result } = renderHook(() => useEntryEditor<{ id: string }>());
    expect(result.current).toMatchObject({ open: false, entry: null, key: "new" });

    act(() => result.current.edit({ id: "e-1" }));
    expect(result.current).toMatchObject({ open: true, entry: { id: "e-1" }, key: "e-1" });

    act(() => result.current.add());
    expect(result.current).toMatchObject({ open: true, entry: null, key: "new" });
  });

  it("keeps the entry as it closes, so the sheet leaves showing it", () => {
    const { result } = renderHook(() => useEntryEditor<{ id: string }>());
    act(() => result.current.edit({ id: "e-1" }));
    act(() => result.current.close());
    expect(result.current).toMatchObject({ open: false, entry: { id: "e-1" }, key: "e-1" });
  });
});
