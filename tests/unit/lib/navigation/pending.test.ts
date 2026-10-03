import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GIVE_UP_MS,
  readNavigation,
  settleNavigation,
  SLOW_MS,
  startNavigation,
  subscribeNavigation,
} from "@/lib/navigation/pending";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  settleNavigation();
  vi.useRealTimers();
});

describe("a navigation on its way", () => {
  it("is quiet while it is quick, and slow once it has taken longer than the skeleton waits", () => {
    const heard = vi.fn();
    const stop = subscribeNavigation(heard);

    startNavigation();
    expect(readNavigation()).toBe("starting");
    vi.advanceTimersByTime(SLOW_MS);
    expect(readNavigation()).toBe("slow");
    expect(heard).toHaveBeenCalledTimes(2);

    settleNavigation();
    expect(readNavigation()).toBe("idle");
    stop();
  });

  it("does not begin twice, and a settled one is not slow later", () => {
    startNavigation();
    startNavigation();
    settleNavigation();
    vi.advanceTimersByTime(SLOW_MS);
    expect(readNavigation()).toBe("idle");
  });

  it("stops waiting for one that never lands", () => {
    startNavigation();
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(readNavigation()).toBe("idle");
  });

  it("tells no one once they stop listening", () => {
    const heard = vi.fn();
    subscribeNavigation(heard)();
    startNavigation();
    expect(heard).not.toHaveBeenCalled();
  });
});
