import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { OPEN_TREATMENT_STATUSES } from "@/constants/statuses";
import { functionBody, latestFunctionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0025_treatment_screens.sql");

/** Every refusal a function raises is one of the app's own codes. */
function refusesInOwnWords(body: string) {
  for (const hint of quoted(body.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
    expect(isErrorMessageCode(hint), hint).toBe(true);
  }
}

describe("0025 a session, and the treatment completed with it (D257)", () => {
  const record = functionBody(sql, "record_treatment_session");

  it("replaces 0024's, taking p_complete — false unless asked", () => {
    expect(sql).toContain("drop function public.record_treatment_session(uuid, uuid, text, jsonb);");
    expect(record).toContain("p_complete boolean default false");
    expect(latestFunctionBody("record_treatment_session")).toBe(record);
  });

  it("keeps 0024's rules: the visit's permission, the patient's treatment, the copy read, a closed one taking none", () => {
    expect(record).toContain("public.visit_for_change(p_visit_id, 'visits.edit')");
    expect(record).toContain("if treatment.id is null or treatment.patient_id <> visit.patient_id then");
    expect(record).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'VISIT_CHANGED'/);
    expect(record).toMatch(
      /if treatment\.status in \('COMPLETED', 'CANCELLED'\) then\s+raise exception [^;]*'TREATMENT_CLOSED'/,
    );
    expect(record).toContain("set status = 'IN_PROGRESS', started_on = coalesce(started_on, visit.visit_date)");
    refusesInOwnWords(record);
  });

  it("completes it in the same transaction, as check_treatment allows, once", () => {
    expect(record).toContain("if coalesce(p_complete, false) and status_after <> 'COMPLETED' then");
    expect(record).toContain("update public.treatments set status = 'COMPLETED' where id = treatment.id;");
    expect(record).toContain("'status_before', treatment.status,\n    'status_after', status_after");
  });

  it("is called by members only", () => {
    expect(sql).toContain(
      "revoke all on function public.record_treatment_session(uuid, uuid, text, jsonb, boolean) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.record_treatment_session(uuid, uuid, text, jsonb, boolean) to authenticated;",
    );
  });
});

describe("0025 removing a session by its treatment and visit (D254)", () => {
  const remove = functionBody(sql, "remove_treatment_session");

  it("replaces 0024's, with visits.edit, a clinic that can write, and its visit still open", () => {
    expect(sql).toContain("drop function public.remove_treatment_session(uuid);");
    expect(remove).toContain("remove_treatment_session(p_treatment_id uuid, p_visit_id uuid)");
    expect(remove).toContain("if clinic is null or not public.has_permission('visits.edit') then");
    expect(remove.indexOf("perform public.require_clinic_write(clinic);")).toBeLessThan(
      remove.indexOf("public.visit_for_change(p_visit_id, 'visits.edit')"),
    );
    expect(remove).toContain(
      "where session.clinic_id = clinic and session.treatment_id = p_treatment_id and session.visit_id = visit.id;",
    );
    expect(remove).toMatch(/if visit\.status <> 'OPEN' then\s+raise exception [^;]*'TREATMENT_SESSION_KEPT'/);
    refusesInOwnWords(remove);
    expect(sql).toContain("revoke all on function public.remove_treatment_session(uuid, uuid) from public, anon;");
    expect(sql).toContain("grant execute on function public.remove_treatment_session(uuid, uuid) to authenticated;");
  });
});

describe("0025 a visit's treatments (D256)", () => {
  const treatments = functionBody(sql, "visit_treatments");

  it("is a computed relationship of a visit, run as the caller so the policies hold", () => {
    expect(treatments).toContain("visit_treatments(p_visit public.visits)\nreturns setof public.treatments");
    expect(treatments).not.toContain("security definer");
    expect(sql).toContain("grant execute on function public.visit_treatments(public.visits) to authenticated;");
  });

  it("holds the patient's open treatments, and those begun or worked on in this visit, oldest first", () => {
    expect(treatments).toContain("treatment.clinic_id = p_visit.clinic_id");
    expect(treatments).toContain("and treatment.patient_id = p_visit.patient_id");
    expect(quoted(/treatment\.status in \(([^)]*)\)/.exec(treatments)![1])).toEqual([...OPEN_TREATMENT_STATUSES]);
    expect(treatments).toContain("or treatment.started_visit_id = p_visit.id");
    expect(treatments).toContain("and session.visit_id = p_visit.id");
    expect(treatments).toContain("order by treatment.created_at, treatment.id;");
  });
});
