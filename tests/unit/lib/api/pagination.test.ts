import { describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";
import { pageWindow, toPage } from "@/lib/api/pagination";

const rows = (count: number) => Array.from({ length: count }, (_, index) => index);

describe("pagination", () => {
  it("asks for one row more than a page, from where the page starts", () => {
    expect(pageWindow()).toEqual({ from: 0, to: PAGE_SIZE });
    expect(pageWindow(40)).toEqual({ from: 40, to: 40 + PAGE_SIZE });
  });

  it("keeps a page's worth and points at the next page when the extra row came back", () => {
    const page = toPage(rows(PAGE_SIZE + 1), 20);
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.nextCursor).toBe(String(20 + PAGE_SIZE));
  });

  it("ends the list when no extra row came back", () => {
    expect(toPage(rows(3))).toEqual({ items: [0, 1, 2], nextCursor: null });
    expect(toPage(rows(PAGE_SIZE)).nextCursor).toBeNull();
  });
});
