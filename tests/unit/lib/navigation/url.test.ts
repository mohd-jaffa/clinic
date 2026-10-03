import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPage } from "@/lib/navigation/url";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPage", () => {
  it("loads a new page for a new account, in place of this one", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    loadPage("/login");
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
