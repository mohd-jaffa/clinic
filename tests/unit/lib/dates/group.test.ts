import { describe, expect, it } from "vitest";

import { byDay } from "@/lib/dates/group";

describe("byDay (D332, D390)", () => {
  it("groups rows by their day, in the order they came", () => {
    const rows = [
      { id: "a", day: "2026-10-24" },
      { id: "b", day: "2026-10-24" },
      { id: "c", day: "2026-10-20" },
    ];
    expect(byDay(rows, (row) => row.day)).toEqual([
      { day: "2026-10-24", rows: [rows[0], rows[1]] },
      { day: "2026-10-20", rows: [rows[2]] },
    ]);
    expect(byDay([], (row: { day: string }) => row.day)).toEqual([]);
  });
});
