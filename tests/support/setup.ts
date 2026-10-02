import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library's own cleanup is not registered automatically without
// globals, so each test would otherwise render on top of the one before.
afterEach(cleanup);

// jsdom has no modal dialogs: no showModal() or close(), and not the
// browser's rule that a closed <dialog> is not drawn. Enough of both for a
// test to see a sheet open and close; the top layer, the inert page and real
// focus behaviour are checked in a browser.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  const modal = new WeakSet<HTMLDialogElement>();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    modal.add(this);
  };
  // Escape in a modal dialog fires `cancel`, and closes it unless that is
  // prevented — only the one on top, once the key has been through the page.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const dialog = (event.target as Element | null)?.closest?.("dialog[open]");
    if (!(dialog instanceof HTMLDialogElement) || !modal.has(dialog)) return;
    if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
  });
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  const style = document.createElement("style");
  style.textContent = "dialog:not([open]) { display: none; }";
  document.head.append(style);
}

// Next's navigation hooks need a router; screens only read from it in tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// jsdom has no popovers: no showPopover() or hidePopover(), and not the rule
// that a popover not shown is not drawn. Enough for a test to see a list open
// and close; the top layer and where it is placed are checked in a browser.
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute("data-popover-open", "");
  };
  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute("data-popover-open");
  };
  const style = document.createElement("style");
  style.textContent = "[popover]:not([data-popover-open]) { display: none; }";
  document.head.append(style);
}
