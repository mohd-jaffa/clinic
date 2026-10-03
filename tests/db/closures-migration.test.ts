import { describe, expect, it } from "vitest";

import { MAX_CLOSURE_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { cleanTextLimit, functionBody, readMigration, tableBody } from "@tests/support/sql";

const sql = readMigration("0011_closures.sql");
const table = tableBody(sql, "clinic_closures");

describe("0011 holidays and leave (plan §9; D84 – D86)", () => {
  it("bounds the reason as the form does, and the length as MAX_CLOSURE_DAYS", () => {
    expect(cleanTextLimit(sql, "clinic_closures", "reason")).toBe(TEXT_LIMITS.closureReason);
    expect(table).toContain("check (ends_on >= starts_on)");
    // Both ends counted: the last day is at most MAX_CLOSURE_DAYS - 1 after the first.
    expect(table).toContain(`check (ends_on - starts_on < ${MAX_CLOSURE_DAYS})`);
  });

  it("names only a doctor of the same clinic, and hangs from the clinic", () => {
    expect(sql).toContain("alter table public.doctors add constraint doctors_id_clinic_unique unique (id, clinic_id);");
    expect(table).toContain(
      "foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade",
    );
    expect(table).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
  });

  it("never lets two closures for the same people share a day", () => {
    expect(table).toMatch(
      /clinic_closures_clinic_overlap exclude using gist \(\s*clinic_id with =,\s*daterange\(starts_on, ends_on, '\[\]'\) with &&\s*\) where \(doctor_id is null\)/,
    );
    expect(table).toMatch(
      /clinic_closures_doctor_overlap exclude using gist \(\s*doctor_id with =,\s*daterange\(starts_on, ends_on, '\[\]'\) with &&\s*\) where \(doctor_id is not null\)/,
    );
  });

  it("starts a new one today or later in the clinic's timezone, and names who added it", () => {
    const check = functionBody(sql, "check_new_closure");
    expect(check).toContain("if new.starts_on < public.clinic_today(new.clinic_id) then");
    expect(check).toContain("new.created_by = coalesce(auth.uid(), new.created_by);");
    expect(sql).toContain(
      "create trigger check_new_closure before insert on public.clinic_closures\nfor each row execute function public.check_new_closure();",
    );
    expect(sql).toContain("revoke all on function public.check_new_closure() from public, anon, authenticated;");
  });

  it("removes one only through remove_closure: settings.manage, the caller's clinic, not yet over", () => {
    const remove = functionBody(sql, "remove_closure");
    expect(remove).toContain("clinic uuid := public.require_clinic_settings();");
    expect(remove).toContain("where c.id = p_closure_id and c.clinic_id = clinic");
    expect(remove).toContain("if closure.ends_on < public.clinic_today(clinic) then");
    expect(sql).toContain("grant execute on function public.remove_closure(uuid) to authenticated;");
  });

  it("refuses with the app's own codes", () => {
    const codes = [...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]);
    expect(codes).toEqual(["CLOSURE_STARTS_BEFORE_TODAY", "RECORD_NOT_FOUND", "CLOSURE_OVER"]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
  });

  it("is read by every member and added with settings.manage while the clinic can write; never edited or deleted directly", () => {
    expect(sql).toContain(
      "create policy clinic_closures_select on public.clinic_closures\nfor select to authenticated\nusing (clinic_id = (select public.current_clinic_id()));",
    );
    const insert = /create policy clinic_closures_insert[\s\S]*?;/.exec(sql)![0];
    expect(insert).toContain("(select public.has_permission('settings.manage'))");
    expect(insert).toContain("(select public.clinic_can_write())");
    expect(sql).toContain("grant select, insert on public.clinic_closures to authenticated;");
    expect(sql).not.toMatch(
      /create policy [^;]*for (update|delete)|grant [^;]*(update|delete)[^;]* on public\.clinic_closures/,
    );
  });
});
