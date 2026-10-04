import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  it("holds the first value straight away", () => {
    const { result } = renderHook(() => useDebouncedValue("Rohan", 10));
    expect(result.current).toBe("Rohan");
  });

  it("waits for the typing to settle before changing", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 30), {
      initialProps: { value: "R" },
    });

    rerender({ value: "Ro" });
    rerender({ value: "Roh" });
    // Still the first value: each keystroke restarted the wait.
    expect(result.current).toBe("R");

    await waitFor(() => expect(result.current).toBe("Roh"));
  });
});
