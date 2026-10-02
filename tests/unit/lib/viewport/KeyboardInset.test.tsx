import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KeyboardInset } from "@/lib/viewport/KeyboardInset";

/** A visual viewport the test can shrink, as a keyboard opening does. */
class FakeViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

const inset = () => document.documentElement.style.getPropertyValue("--keyboard-inset");
let viewport: FakeViewport;

beforeEach(() => {
  viewport = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
});

describe("KeyboardInset", () => {
  it("is 0 while nothing covers the layout", () => {
    render(<KeyboardInset />);
    expect(inset()).toBe("0px");
  });

  it("follows the keyboard as it opens and closes", () => {
    render(<KeyboardInset />);

    viewport.height = 460;
    viewport.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("340px");

    viewport.height = 800;
    viewport.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("0px");
  });

  it("allows for the visual viewport scrolling within the layout", () => {
    render(<KeyboardInset />);
    viewport.height = 460;
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event("scroll"));
    expect(inset()).toBe("300px");
  });

  it("stops and clears the value when it goes", () => {
    const { unmount } = render(<KeyboardInset />);
    viewport.height = 460;
    viewport.dispatchEvent(new Event("resize"));
    unmount();
    expect(inset()).toBe("");
  });

  it("does nothing where there is no visual viewport", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    expect(() => render(<KeyboardInset />)).not.toThrow();
  });
});
