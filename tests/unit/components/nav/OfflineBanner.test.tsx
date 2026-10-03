import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "@/components/nav/OfflineBanner";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineBanner (plan §21, D55)", () => {
  it("keeps a polite place at the top, empty while there is a connection", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    const place = screen.getByRole("status");
    expect(place).toBeEmptyDOMElement();
    expect(place).not.toHaveAttribute("data-band");
  });

  it("says so when the connection drops, and that what is typed stays, then goes when it is back", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    const place = screen.getByRole("status");
    expect(place).toHaveTextContent("You’re offline. What you type stays here until it can be saved.");
    // A band across the top: the screen under it does not pay the safe area again.
    expect(place).toHaveAttribute("data-band");

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
