import { describe, it, expect } from "vitest";
import { paiseToRupees, paiseToText, parseRupees, roundToPaise, rupeesToPaise, sumPaise } from "@/lib/money";

describe("roundToPaise", () => {
  it("rounds positive numbers to 2 decimal places", () => {
    expect(roundToPaise(10.505)).toBe(10.51);
    expect(roundToPaise(10.504)).toBe(10.5);
    expect(roundToPaise(100)).toBe(100);
  });

  it("handles negative numbers correctly", () => {
    expect(roundToPaise(-10.505)).toBe(-10.51);
    expect(roundToPaise(-10.504)).toBe(-10.5);
  });
});

describe("rupeesToPaise", () => {
  it("reads the digits as typed, so nothing goes through a float", () => {
    expect(rupeesToPaise("19.99")).toBe(1999);
    expect(rupeesToPaise("499.50")).toBe(49950);
    expect(rupeesToPaise("500")).toBe(50000);
    expect(rupeesToPaise("0.05")).toBe(5);
  });

  it("pads a single decimal place", () => {
    expect(rupeesToPaise("12.5")).toBe(1250);
  });

  it("keeps a negative amount negative", () => {
    expect(rupeesToPaise("-12.34")).toBe(-1234);
  });

  it("accepts a number too, rounding to the paisa", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it("is exact where multiplying by 100 is not", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754.
    expect(rupeesToPaise("19.99")).not.toBe(Math.floor(19.99 * 100));
  });
});

describe("paiseToRupees", () => {
  it("converts for display", () => {
    expect(paiseToRupees(49950)).toBe(499.5);
  });
});

describe("paiseToText", () => {
  it("writes paise as a money field holds them, and reads back to the same paise", () => {
    expect(paiseToText(0)).toBe("0");
    expect(paiseToText(150000)).toBe("1500");
    expect(paiseToText(150050)).toBe("1500.50");
    expect(paiseToText(5)).toBe("0.05");
    for (const paise of [0, 5, 99, 100, 150050, 100_000_000]) expect(parseRupees(paiseToText(paise))).toBe(paise);
  });
});

describe("sumPaise", () => {
  it("adds up whole paise", () => {
    expect(sumPaise([1999, 49950, 5])).toBe(51954);
  });

  it("is zero for nothing", () => {
    expect(sumPaise([])).toBe(0);
  });
});

describe("parseRupees", () => {
  it("reads money the way people write it, as whole paise", () => {
    expect(parseRupees("1500")).toBe(150000);
    expect(parseRupees("₹1,500")).toBe(150000);
    expect(parseRupees("1,00,000.50")).toBe(10000050);
    expect(parseRupees(" ₹ 250 ")).toBe(25000);
    expect(parseRupees("19.99")).toBe(1999);
  });

  it("is null for anything that is not an amount — never NaN", () => {
    for (const text of ["", "₹", "abc", "1.234", "-5", "1e3", "12..5"]) {
      expect(parseRupees(text)).toBeNull();
    }
  });
});

describe("money at the edges", () => {
  it("still answers for an amount past fifteen digits, far beyond any the app accepts", () => {
    expect(Math.abs(roundToPaise(1e21) - 1e21) / 1e21).toBeLessThan(1e-12);
  });

  it("reads text it cannot take digit by digit through rounding, never truncation", () => {
    expect(rupeesToPaise("12.345")).toBe(1235);
    expect(rupeesToPaise("1e3")).toBe(100_000);
  });
});
