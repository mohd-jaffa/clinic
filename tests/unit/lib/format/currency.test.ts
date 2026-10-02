import { describe, it, expect } from "vitest";
import { formatCurrency, formatPaise, formatPaiseCompact } from "@/lib/format/currency";

describe("formatCurrency", () => {
  it("formats whole numbers without trailing zeroes", () => {
    expect(formatCurrency(1500)).toBe("₹1,500");
  });

  it("formats fractional amounts with 2 decimal places", () => {
    expect(formatCurrency(1500.5)).toBe("₹1,500.50");
    expect(formatCurrency(1500.75)).toBe("₹1,500.75");
  });

  it("puts the sign before the rupee symbol, as a loss is written", () => {
    expect(formatCurrency(-4590)).toBe("-₹4,590");
    expect(formatCurrency(-1500.5)).toBe("-₹1,500.50");
    expect(formatCurrency(-10000000)).toBe("-₹1,00,00,000");
  });

  it("never writes a negative zero", () => {
    expect(formatCurrency(-0)).toBe("₹0");
    expect(formatCurrency(-0.001)).toBe("₹0");
  });

  it("handles null or undefined gracefully", () => {
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatPaise", () => {
  it("reads whole paise as rupees, because that is what the app stores", () => {
    expect(formatPaise(49950)).toBe("₹499.50");
    expect(formatPaise(150000)).toBe("₹1,500");
    expect(formatPaise(0)).toBe("₹0");
  });

  it('shows a loss as "-₹4,590", never "₹-4,590"', () => {
    expect(formatPaise(-459000)).toBe("-₹4,590");
    expect(formatPaise(-50)).toBe("-₹0.50");
  });

  it("says nothing rather than zero when there is no figure", () => {
    expect(formatPaise(null)).toBe("—");
    expect(formatPaise(undefined)).toBe("—");
  });
});

describe("formatPaiseCompact", () => {
  it("shortens thousands, lakhs and crores, with one decimal at most", () => {
    expect(formatPaiseCompact(200_000)).toBe("₹2K");
    expect(formatPaiseCompact(150_000)).toBe("₹1.5K");
    expect(formatPaiseCompact(1_234_500)).toBe("₹12.3K");
    expect(formatPaiseCompact(10_000_000)).toBe("₹1L");
    expect(formatPaiseCompact(25_000_000)).toBe("₹2.5L");
    expect(formatPaiseCompact(1_000_000_000)).toBe("₹1Cr");
    expect(formatPaiseCompact(123_456_000_000)).toBe("₹123.5Cr");
    expect(formatPaiseCompact(1_234_500_000_000)).toBe("₹1,234.5Cr");
  });

  it("rounds before choosing a unit, so an amount just under one reads as it", () => {
    expect(formatPaiseCompact(9_999_900)).toBe("₹1L");
    expect(formatPaiseCompact(99_950)).toBe("₹1K");
  });

  it("keeps small amounts whole, and zero as zero", () => {
    expect(formatPaiseCompact(0)).toBe("₹0");
    expect(formatPaiseCompact(50_000)).toBe("₹500");
    expect(formatPaiseCompact(5_050)).toBe("₹51");
  });

  it("signs a negative amount and dashes nothing", () => {
    expect(formatPaiseCompact(-200_000)).toBe("-₹2K");
    expect(formatPaiseCompact(null)).toBe("—");
    expect(formatPaiseCompact(undefined)).toBe("—");
    expect(formatPaiseCompact(Number.NaN)).toBe("—");
  });
});
