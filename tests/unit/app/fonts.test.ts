import { describe, expect, it, vi } from "vitest";

const { Figtree } = vi.hoisted(() => ({ Figtree: vi.fn(() => ({ variable: "figtree" })) }));
vi.mock("next/font/google", () => ({ Figtree }));

const { figtree } = await import("@/app/fonts");

describe("the app's face (D64)", () => {
  it("is Figtree, regular and bold, with the latin-ext subset that holds the rupee sign", () => {
    expect(figtree).toEqual({ variable: "figtree" });
    expect(Figtree).toHaveBeenCalledWith({
      variable: "--font-figtree",
      subsets: ["latin", "latin-ext"],
      weight: ["400", "700"],
      display: "swap",
    });
  });
});
