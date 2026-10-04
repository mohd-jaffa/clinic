import { describe, expect, it } from "vitest";

import { phoneDigits, recordNumber, searchTerms, searchWords } from "@/lib/supabase/search";

describe("searchWords", () => {
  it("keeps the words, spaces tidied", () => {
    expect(searchWords("  Anu   Sharma ")).toBe("Anu Sharma");
  });

  it("drops wildcards and what would break a filter", () => {
    expect(searchWords(`50%_off\\ "Rohan" (big), a*b:c`)).toBe("50 off Rohan big a b c");
  });

  it("has nothing to look for when nothing safe is left", () => {
    expect(searchWords(" %_* ")).toBeNull();
  });
});

describe("phoneDigits", () => {
  it("reads a phone however it was typed", () => {
    expect(phoneDigits("98765 43210")).toBe("9876543210");
    expect(phoneDigits("+91-98765-43210")).toBe("9876543210");
    expect(phoneDigits("919876543210")).toBe("9876543210");
    expect(phoneDigits("098765 43210")).toBe("9876543210");
    expect(phoneDigits("543")).toBe("543");
  });

  it("says too little to match on with fewer than three digits", () => {
    expect(phoneDigits("Anu 12")).toBeNull();
    expect(phoneDigits("Anu")).toBeNull();
  });
});

describe("recordNumber", () => {
  it("reads a number with or without its letters", () => {
    expect(recordNumber("P-1012")).toBe(1012);
    expect(recordNumber("p 1012")).toBe(1012);
    expect(recordNumber(" 1012 ")).toBe(1012);
  });

  it("is no number when there are words beside it", () => {
    expect(recordNumber("Rohan 12")).toBeNull();
    expect(recordNumber("98765 43210")).toBeNull();
  });
});

describe("searchTerms", () => {
  it("reads a search every way it may be meant", () => {
    expect(searchTerms("P-1012")).toEqual({ words: "P-1012", digits: "1012", number: 1012 });
    expect(searchTerms("Rohan")).toEqual({ words: "Rohan", digits: null, number: null });
    expect(searchTerms("98765 43210")).toEqual({ words: "98765 43210", digits: "9876543210", number: null });
  });

  it("looks for nothing when nothing is typed", () => {
    for (const search of [null, undefined, "", " %% "]) {
      expect(searchTerms(search)).toEqual({ words: null, digits: null, number: null });
    }
  });
});
