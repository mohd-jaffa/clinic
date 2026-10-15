import { describe, expect, it } from "vitest";

import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0027_follow_up_callers.sql");
const before = readMigration("0026_follow_ups.sql");

/** A function's body with who made the last contact taken out: what 0026 had. */
const without = (body: string) =>
  body
    .replace(", contact.caller", "")
    .replace(", caller.full_name as caller", "")
    .replace("        left join public.profiles as caller on caller.id = last.contacted_by\n", "")
    .replace(", row.last_contacted_by", "")
    .replace(",\n  last_contacted_by text", "");

describe("0027 who made a follow-up's last contact (plan §14.3, D275)", () => {
  it("hands back the caller's name with the last contact, from their profile", () => {
    const rows = functionBody(sql, "follow_up_rows");
    expect(rows).toContain("caller.full_name as caller");
    expect(rows).toContain("left join public.profiles as caller on caller.id = last.contacted_by");
    expect(rows).toContain("contact.outcome, contact.contacted_at, contact.note, contact.caller");
    expect(functionBody(sql, "follow_up_items")).toContain(
      "row.last_contacted_at, row.last_note, row.last_contacted_by",
    );
    for (const name of ["follow_up_rows", "follow_up_items"]) {
      expect(
        new RegExp(
          `function public\\.${name}\\([^)]*\\)\\s+returns table \\([^;]*last_note text,\\s+last_contacted_by text\\s+\\)`,
        ).test(sql),
      ).toBe(true);
    }
  });

  it("changes nothing else of what 0026 worked out", () => {
    for (const name of ["follow_up_rows", "follow_up_items"]) {
      expect(without(functionBody(sql, name))).toBe(functionBody(before, name));
    }
  });

  it("is dropped and made again, kept from the member as 0026 kept it", () => {
    expect(sql).toContain("drop function public.follow_up_items(text, integer, integer);");
    expect(sql).toContain("drop function public.follow_up_rows();");
    expect(sql).toContain("revoke all on function public.follow_up_rows() from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function public.follow_up_items(text, integer, integer) from public, anon;");
    expect(sql).toContain("grant execute on function public.follow_up_items(text, integer, integer) to authenticated;");
  });
});
