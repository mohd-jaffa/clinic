import { describe, expect, it, vi } from "vitest";

import { canAnimate } from "@/lib/motion";

describe("canAnimate", () => {
  it("needs an element that can play an animation", () => {
    expect(canAnimate(null)).toBe(false);
    const element = document.createElement("div");
    expect(canAnimate(element)).toBe(false);
    element.animate = vi.fn();
    expect(canAnimate(element)).toBe(true);
  });
});
