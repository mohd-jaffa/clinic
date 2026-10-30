import { describe, expect, it } from "vitest";

import { ACTIVITY_KIND_TABLES } from "@/constants/statuses";
import { functionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0038_activity.sql");
const activity = functionBody(sql, "clinic_activity");
const kept = new Set(Object.values(ACTIVITY_KIND_TABLES).flat());

describe("0038 the owner's activity log (plan §19; D387 – D390)", () => {
  it("stamps the rows of one change as each is written, so they read in the order they happened", () => {
    expect(sql).toContain("alter table public.audit_logs alter column created_at set default clock_timestamp();");
  });

  it("indexes one person's and one kind's rows, the latest first", () => {
    expect(sql).toContain(
      "create index audit_logs_clinic_actor_idx on public.audit_logs (clinic_id, actor_id, created_at desc);",
    );
    expect(sql).toContain(
      "create index audit_logs_clinic_entity_idx on public.audit_logs (clinic_id, entity_type, created_at desc);",
    );
  });

  it("is the owner's alone, of their own clinic — checked inside, for the reads the trail joins", () => {
    expect(activity).toContain("security definer");
    expect(activity).toContain("clinic uuid := public.current_clinic_id();");
    expect(activity).toMatch(
      /if clinic is null or not public\.is_clinic_owner\(\) then\s+raise exception [^;]*hint = 'AUTH_PERMISSION_DENIED'/,
    );
    expect(activity).toContain("where entry.clinic_id = clinic");
    expect(activity).toContain(
      "left join public.patients as patient on patient.id = linked.patient_id and patient.clinic_id = clinic",
    );
    expect(sql).toContain(
      "revoke all on function public.clinic_activity(uuid, text[], integer, integer) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.clinic_activity(uuid, text[], integer, integer) to authenticated;",
    );
  });

  it("pages first, the latest first, then reads each row's patient, record and names", () => {
    expect(activity).toMatch(
      /order by entry\.created_at desc, entry\.id desc\s+offset p_offset\s+limit p_limit\s+\) as page/,
    );
    expect(activity).toContain("(p_actor is null or entry.actor_id = p_actor)");
    expect(activity).toContain("(p_entity_types is null or entry.entity_type = any (p_entity_types))");
  });

  it("reads only tables a kind keeps, so every row it explains can be found by its kind", () => {
    const tables = quoted(activity.match(/when '[a-z_]+' then/g)!.join(" "));
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) expect(kept.has(table), table).toBe(true);
  });

  it("names the doctors, types and categories a change points at, never a patient", () => {
    expect(activity).toContain(
      "where change.key in ('doctor_id', 'assigned_doctor_id', 'appointment_type_id', 'category_id')",
    );
  });
});
