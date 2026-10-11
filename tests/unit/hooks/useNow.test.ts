import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "@/hooks/useNow";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T05:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("useNow", () => {
  it("reads the time again every interval, and stops when it goes", () => {
    const { result, unmount } = renderHook(() => useNow(15_000));
    expect(result.current.toISOString()).toBe("2026-10-13T05:30:00.000Z");
    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.toISOString()).toBe("2026-10-13T05:30:15.000Z");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
