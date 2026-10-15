import { afterEach, describe, expect, it, vi } from "vitest";

import { needsTap, openChat, shareFile, sharesFiles } from "@/lib/share";

const pdf = new File(["%PDF"], "Rohan.pdf", { type: "application/pdf" });

/** A device's share sheet and pointer, as the test says. */
function device({ coarse, canShare }: { coarse: boolean; canShare?: (data: ShareData) => boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)" && coarse }));
  vi.stubGlobal("navigator", { ...navigator, canShare, share: vi.fn() });
}

afterEach(() => vi.unstubAllGlobals());

describe("sharesFiles (D245, D246)", () => {
  it("is a touch-first device whose share sheet takes a PDF", () => {
    const canShare = vi.fn(() => true);
    device({ coarse: true, canShare });
    expect(sharesFiles()).toBe(true);
    const [[data]] = canShare.mock.calls as unknown as [[ShareData]];
    expect(data.files?.[0]).toMatchObject({ name: "check.pdf", type: "application/pdf" });
  });

  it("is not a desktop, one whose share sheet takes no file, nor one with no share sheet", () => {
    device({ coarse: false, canShare: () => true });
    expect(sharesFiles()).toBe(false);
    device({ coarse: true, canShare: () => false });
    expect(sharesFiles()).toBe(false);
    device({ coarse: true });
    expect(sharesFiles()).toBe(false);
  });
});

describe("shareFile (D245)", () => {
  it("hands over the file and the message, and says whether the sheet was put aside", async () => {
    device({ coarse: true });
    const share = vi.mocked(navigator.share);
    share.mockResolvedValueOnce(undefined);
    expect(await shareFile(pdf, "Your prescription")).toBe(true);
    expect(share).toHaveBeenCalledWith({ files: [pdf], text: "Your prescription" });
    share.mockRejectedValueOnce(new DOMException("Put aside", "AbortError"));
    expect(await shareFile(pdf, "Your prescription")).toBe(false);
  });

  it("passes on any other refusal", async () => {
    device({ coarse: true });
    const refusal = new DOMException("Tap first", "NotAllowedError");
    vi.mocked(navigator.share).mockRejectedValueOnce(refusal);
    await expect(shareFile(pdf, "Your prescription")).rejects.toBe(refusal);
    expect(needsTap(refusal)).toBe(true);
    expect(needsTap(new DOMException("No", "DataError"))).toBe(false);
    expect(needsTap(new Error("No"))).toBe(false);
  });
});

describe("openChat (D246)", () => {
  it("opens the patient's chat on WhatsApp beside the app, the message typed", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    openChat("+919876543210", "Your prescription");
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/919876543210?text=Your%20prescription",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
