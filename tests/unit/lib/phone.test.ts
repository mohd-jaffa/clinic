import { describe, it, expect } from "vitest";
import { toE164India, formatPhoneDigits, callHref, whatsAppHref } from "@/lib/phone";

describe("toE164India", () => {
  it("normalizes 10-digit Indian mobile numbers starting with 6-9", () => {
    expect(toE164India("9876543210")).toBe("+919876543210");
    expect(toE164India("09876543210")).toBe("+919876543210");
    expect(toE164India("+91 98765-43210")).toBe("+919876543210");
  });

  it("rejects invalid mobile numbers", () => {
    expect(toE164India("1234567890")).toBeNull();
    expect(toE164India("98765")).toBeNull();
  });
});

describe("formatPhoneDigits", () => {
  it("formats digits into 5+5 group", () => {
    expect(formatPhoneDigits("9876543210")).toBe("98765 43210");
    expect(formatPhoneDigits("98765")).toBe("98765");
  });
});

describe("formatPhoneDigits with a trunk 0", () => {
  it("drops the leading 0 of an eleven-digit number", () => {
    expect(formatPhoneDigits("09876543210")).toBe("98765 43210");
  });
});

describe("callHref and whatsAppHref", () => {
  it("dial the number, and open a chat with it by its digits", () => {
    expect(callHref("+919876543210")).toBe("tel:+919876543210");
    expect(whatsAppHref("+919876543210")).toBe("https://wa.me/919876543210");
  });

  it("starts a chat with a message the person still sends themselves (plan §22.1)", () => {
    expect(whatsAppHref("+919876543210", "Your appointment is at 10:30 AM & tomorrow")).toBe(
      "https://wa.me/919876543210?text=Your%20appointment%20is%20at%2010%3A30%20AM%20%26%20tomorrow",
    );
  });
});

describe("formatPhoneDigits, as typed with a trunk zero", () => {
  it("drops the leading 0 of an eleven-digit number", () => {
    expect(formatPhoneDigits("09876543210")).toBe("98765 43210");
  });
});

describe("formatPhoneDigits, as typed with the country code", () => {
  it("drops the 91 in front of a full number", () => {
    expect(formatPhoneDigits("+91 98765 43210")).toBe("98765 43210");
  });
});
