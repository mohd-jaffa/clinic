import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnline } from "@/hooks/useOnline";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOnline", () => {
  it("follows the connection as it drops and comes back", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("is online while the page is drawn on the server, which cannot know", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    function Place() {
      return useOnline() ? "online" : "offline";
    }
    expect(renderToString(createElement(Place))).toBe("online");
  });
});
