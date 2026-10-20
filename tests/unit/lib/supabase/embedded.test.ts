import { describe, expect, it } from "vitest";

import { oneOf } from "@/lib/supabase/embedded";

describe("oneOf", () => {
  it("reads an embedded row given as one, as a list of one, or as none", () => {
    expect(oneOf({ balance_paise: 5 })).toEqual({ balance_paise: 5 });
    expect(oneOf([{ balance_paise: 5 }])).toEqual({ balance_paise: 5 });
    expect(oneOf([])).toBeNull();
    expect(oneOf(null)).toBeNull();
    expect(oneOf(undefined)).toBeNull();
  });
});
