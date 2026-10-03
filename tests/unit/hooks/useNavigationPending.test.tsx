/* eslint-disable @next/next/no-html-link-for-pages -- the hook listens for the anchor a Link renders; a bare one is that anchor without a router. */
import { act, render, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationPending } from "@/hooks/useNavigationPending";
import { readNavigation, settleNavigation, SLOW_MS, startNavigation } from "@/lib/navigation/pending";

// jsdom cannot follow a link: the click stops at the document, after the hook has seen it.
const stay = (event: Event) => event.preventDefault();
beforeEach(() => {
  vi.useFakeTimers();
  document.addEventListener("click", stay);
});
afterEach(() => {
  document.removeEventListener("click", stay);
  settleNavigation();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function click(element: Element, init: MouseEventInit = {}) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
}

describe("useNavigationPending", () => {
  it("is slow only once a link to another screen has been followed for a while, and over when the screen arrives", () => {
    const { result, rerender } = renderHook(({ path }) => useNavigationPending(path), {
      initialProps: { path: "/" },
    });
    const { container } = render(<a href="/patients">Patients</a>);

    act(() => click(container.querySelector("a")!));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(SLOW_MS));
    expect(result.current).toBe(true);

    rerender({ path: "/patients" });
    expect(result.current).toBe(false);
  });

  it("ignores what does not leave for another of the app's screens", () => {
    renderHook(() => useNavigationPending("/"));
    const { container } = render(
      <div>
        <a href="/">Here</a>
        <a href="https://elsewhere.example/">Away</a>
        <a href="/api/bills/b-1/pdf">Bill</a>
        <a href="/patients" download>
          Download
        </a>
        <a href="/patients" target="_blank" rel="noreferrer">
          New tab
        </a>
        <a href="/queue">Queue</a>
        <button type="button">Not a link</button>
      </div>,
    );
    const [here, away, bill, download, newTab, queue] = container.querySelectorAll("a");

    for (const link of [here, away, bill, download, newTab]) act(() => click(link));
    act(() => click(queue, { metaKey: true }));
    act(() => click(queue, { button: 1 }));
    act(() => click(container.querySelector("button")!));
    expect(readNavigation()).toBe("idle");
  });

  it("is idle while the page is drawn on the server, and ignores a click on nothing in particular", () => {
    function Shell() {
      return <p>{useNavigationPending("/") ? "on its way" : "here"}</p>;
    }
    expect(renderToString(<Shell />)).toContain("here");

    renderHook(() => useNavigationPending("/"));
    act(() => void document.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })));
    expect(readNavigation()).toBe("idle");
  });

  it("stops listening when the shell goes", () => {
    const { unmount } = renderHook(() => useNavigationPending("/"));
    unmount();
    const { container } = render(<a href="/patients">Patients</a>);
    act(() => click(container.querySelector("a")!));
    expect(readNavigation()).toBe("idle");
  });

  it("hears a navigation that code began, too", () => {
    const { result } = renderHook(() => useNavigationPending("/"));
    act(() => {
      startNavigation();
      vi.advanceTimersByTime(SLOW_MS);
    });
    expect(result.current).toBe(true);
  });
});
