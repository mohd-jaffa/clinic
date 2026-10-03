import { afterEach, describe, expect, it, vi } from "vitest";

import { backOnline, isOnline, NETWORK_RETRY_DELAYS_MS, onConnectionChange } from "@/lib/network/connection";

const setOnline = (online: boolean) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the connection (plan §21, D55)", () => {
  it("is as the browser knows it", () => {
    setOnline(false);
    expect(isOnline()).toBe(false);
    setOnline(true);
    expect(isOnline()).toBe(true);
  });

  it("is taken as online off the browser, where a page is drawn on the server", () => {
    vi.stubGlobal("navigator", undefined);
    try {
      expect(isOnline()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tells a listener when it drops and when it comes back, until told to stop", () => {
    const listener = vi.fn();
    const stop = onConnectionChange(listener);
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    window.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("is waited for: at once while online, else until it comes back", async () => {
    setOnline(true);
    await expect(backOnline()).resolves.toBeUndefined();

    setOnline(false);
    let back = false;
    const waiting = backOnline().then(() => {
      back = true;
    });
    await Promise.resolve();
    expect(back).toBe(false);
    window.dispatchEvent(new Event("online"));
    await waiting;
    expect(back).toBe(true);
  });

  it("gives a write a few tries, a little further apart each time", () => {
    expect(NETWORK_RETRY_DELAYS_MS).toEqual([1_000, 2_000, 4_000]);
  });
});
