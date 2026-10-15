import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import {
  OPEN_TREATMENT_STATUSES,
  TREATMENT_START_STATUSES,
  TREATMENT_STATUS_TRANSITIONS,
  TREATMENT_STATUSES,
  type TreatmentStatus,
} from "@/constants/statuses";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0024_treatments.sql");
const treatments = tableBody(sql, "treatments");
const sessions = tableBody(sql, "treatment_sessions");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

/** The statuses a piece of SQL names as open, as `status in (...)` lists them. */
const openIn = (text: string) => quoted(/status in \(('PLANNED'[^)]*)\)/.exec(text)![1]);

/** Every refusal a function raises is one of the app's own codes. */
function refusesInOwnWords(body: string) {
  for (const hint of quoted(body.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
    expect(isErrorMessageCode(hint), hint).toBe(true);
  }
}

describe("0024 a treatment (plan §14.1, §28.5)", () => {
  it("hangs from the clinic and names its own patient, doctor and visit", () => {
    expect(treatments).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(treatments).toContain("unique (id, clinic_id)");
    expect(treatments).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id)");
    expect(treatments).toContain("foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id)");
    expect(treatments).toContain("foreign key (started_visit_id, clinic_id) references public.visits (id, clinic_id)");
  });

  it("holds the statuses the app knows, and bounds its text and cost as the screen does", () => {
    expect(checkedValues(treatments, "status")).toEqual([...TREATMENT_STATUSES]);
    expect(columnLine(sql, "treatments", "status")).toContain("default 'PLANNED'");
    expect(cleanTextLimit(sql, "treatments", "name")).toBe(TEXT_LIMITS.treatmentName);
    expect(columnLine(sql, "treatments", "name")).toContain("text not null");
    expect(cleanTextLimit(sql, "treatments", "description")).toBe(TEXT_LIMITS.treatmentDescription);
    expect(columnLine(sql, "treatments", "description")).toContain("is_clean_text");
    expect(cleanTextLimit(sql, "treatments", "cancel_reason")).toBe(TEXT_LIMITS.reason);
    expect(betweenBounds(sql, "treatments", "estimated_cost_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
    expect(columnLine(sql, "treatments", "estimated_cost_paise")).toContain("integer");
  });

  it("keeps who made, changed and cancelled it after the audit purge", () => {
    for (const actor of ["created_by", "updated_by", "cancelled_by"]) {
      expect(columnLine(sql, "treatments", actor)).toContain("references public.profiles (id) on delete set null");
    }
    expect(sql).toContain("create trigger set_treatments_actor before insert or update on public.treatments");
    expect(sql).toContain("create trigger set_treatments_updated_at before update on public.treatments");
  });

  it("is started once in progress, completed on its day, cancelled when it was, and due only while open", () => {
    expect(treatments).toContain("(status <> 'PLANNED' or started_on is null)");
    expect(treatments).toContain("(status not in ('IN_PROGRESS', 'COMPLETED') or started_on is not null)");
    expect(treatments).toContain("(status = 'COMPLETED') = (completed_on is not null) and completed_on >= started_on");
    expect(treatments).toContain(
      "(status = 'CANCELLED') = (cancelled_at is not null) and (cancel_reason is null or status = 'CANCELLED')",
    );
    const due = /constraint treatments_next_due check \((.*)\)$/m.exec(treatments)![1];
    expect(openIn(due)).toEqual([...OPEN_TREATMENT_STATUSES]);
  });
});

describe("0024 statuses (plan §14.1; D248, D250, D252)", () => {
  const check = functionBody(sql, "check_treatment");

  it("moves a status only as TREATMENT_STATUS_TRANSITIONS says", () => {
    const next = functionBody(sql, "treatment_status_next");
    const table = Object.fromEntries(
      [...next.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)].map(([, from, to]) => [from, quoted(to)]),
    ) as Record<TreatmentStatus, string[]>;
    expect(table).toEqual(TREATMENT_STATUS_TRANSITIONS);
    expect(check).toContain(
      "if new.status is distinct from old.status and not new.status = any (public.treatment_status_next(old.status)) then",
    );
  });

  it("starts planned or in progress, and never changes whose it is or where it began", () => {
    expect(quoted(/new\.status not in \(([^)]*)\)/.exec(check)![1])).toEqual([...TREATMENT_START_STATUSES]);
    expect(check).toContain(
      "if new.patient_id <> old.patient_id or new.started_visit_id is distinct from old.started_visit_id then",
    );
  });

  it("starts on the day it goes in progress unless a session gave one, and stamps completing and cancelling", () => {
    expect(check).toContain(
      "elsif new.status = 'IN_PROGRESS' and new.started_on is null then\n    new.started_on := today;",
    );
    expect(check).toContain("new.completed_on := today;");
    expect(check).toContain("new.cancelled_at := now();\n      new.cancelled_by := auth.uid();");
  });

  it("closed, keeps its doctor and has no next due day (D252); due again today or later; its doctor active", () => {
    expect(check).toMatch(
      /if old\.status in \('COMPLETED', 'CANCELLED'\) and \(doctor_given or due_given\) then\s+raise exception [^;]*'TREATMENT_CLOSED'/,
    );
    expect(check).toContain("if new.status in ('COMPLETED', 'CANCELLED') then\n    new.next_due_on := null;");
    expect(check).toContain("elsif due_given and new.next_due_on < today then");
    expect(check).toContain("doctor.clinic_id = new.clinic_id and doctor.active and member.status = 'ACTIVE'");
    refusesInOwnWords(check);
  });

  it("grows the doctor scope with the treatment's doctor (plan §27.3)", () => {
    expect(sql).toContain(
      "create trigger add_treatment_doctor after insert or update of doctor_id on public.treatments",
    );
    expect(functionBody(sql, "add_treatment_doctor")).toContain(
      "insert into public.patient_doctors (clinic_id, patient_id, doctor_id)",
    );
  });
});

describe("0024 a session (plan §14.1)", () => {
  it("is one per treatment and visit, of the clinic's own, with a note bounded as the screen does", () => {
    expect(sessions).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(sessions).toContain("unique (treatment_id, visit_id)");
    expect(sessions).toContain("foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id)");
    expect(sessions).toContain("foreign key (visit_id, clinic_id) references public.visits (id, clinic_id)");
    expect(cleanTextLimit(sql, "treatment_sessions", "note")).toBe(TEXT_LIMITS.sessionNote);
    expect(columnLine(sql, "treatment_sessions", "note")).toContain("is_clean_text");
    for (const actor of ["created_by", "updated_by"]) {
      expect(columnLine(sql, "treatment_sessions", actor)).toContain(
        "references public.profiles (id) on delete set null",
      );
    }
    expect(sql).toContain(
      "create trigger set_treatment_sessions_actor before insert or update on public.treatment_sessions",
    );
  });
});

describe("0024 indexes (plan §37.1)", () => {
  it("lead with the clinic for a patient's, a doctor's and a visit's reads, and cover each foreign key", () => {
    for (const index of [
      "create index treatments_clinic_id_patient_id_idx on public.treatments (clinic_id, patient_id, created_at desc);",
      "create index treatments_clinic_id_doctor_id_idx on public.treatments (clinic_id, doctor_id);",
      "create index treatments_clinic_id_started_visit_id_idx\n  on public.treatments (clinic_id, started_visit_id) where started_visit_id is not null;",
      "create index treatments_created_by_idx on public.treatments (created_by);",
      "create index treatments_updated_by_idx on public.treatments (updated_by);",
      "create index treatments_cancelled_by_idx on public.treatments (cancelled_by) where cancelled_by is not null;",
      "create index treatment_sessions_clinic_id_treatment_id_idx\n  on public.treatment_sessions (clinic_id, treatment_id, created_at);",
      "create index treatment_sessions_clinic_id_visit_id_idx on public.treatment_sessions (clinic_id, visit_id);",
      "create index treatment_sessions_created_by_idx on public.treatment_sessions (created_by);",
      "create index treatment_sessions_updated_by_idx on public.treatment_sessions (updated_by);",
    ]) {
      expect(sql).toContain(index);
    }
  });
});

describe("0024 writing a treatment (D248 – D252)", () => {
  it("holds one to change only with visits.edit, in the scope, for a patient not archived, while the clinic writes", () => {
    const held = functionBody(sql, "treatment_for_change");
    expect(held).toContain("if clinic is null or not public.has_permission('visits.edit') then");
    expect(held).toContain("perform public.require_clinic_write(clinic);");
    expect(held).toContain("for update;");
    expect(held).toContain("if found.id is null or not public.can_see_patient(found.patient_id) then");
    expect(held).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(sql).toContain("revoke all on function public.treatment_for_change(uuid) from public, anon, authenticated;");
  });

  it("starts one in a visit as its doctor's, with that visit its first session when begun at once", () => {
    const create = functionBody(sql, "create_treatment");
    expect(create).toContain("if clinic is null or not public.has_permission('visits.edit') then");
    expect(create).toContain("perform public.require_clinic_write(clinic);");
    expect(create).toContain(
      "visit := public.visit_for_change(p_visit_id, 'visits.edit');\n    doctor := visit.doctor_id;",
    );
    expect(create).toContain("if patient.id is null or not public.can_see_patient(patient.id) then");
    expect(create).toContain("case when starting = 'IN_PROGRESS' then visit.visit_date end, visit.id");
    expect(create).toContain("if made.status = 'IN_PROGRESS' and visit.id is not null then");
    refusesInOwnWords(create);
  });

  it("changes its details only from the copy read (D251)", () => {
    const update = functionBody(sql, "update_treatment");
    expect(update).toContain("public.treatment_for_change(p_treatment_id)");
    expect(update).toContain(
      "not fields <@ array['name', 'description', 'estimated_cost_paise', 'next_due_on', 'doctor_id']",
    );
    expect(update).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'TREATMENT_CHANGED'/);
    refusesInOwnWords(update);
  });

  it("moves its status as the table allows, from the status read, a reason only with a cancellation (D250)", () => {
    const change = functionBody(sql, "change_treatment_status");
    expect(change).toContain("if p_reason is not null and p_status is distinct from 'CANCELLED' then");
    expect(change).toContain("if was.status = p_status then");
    expect(change).toMatch(/if was\.status is distinct from p_seen then\s+raise exception [^;]*'TREATMENT_CHANGED'/);
    expect(change).toContain("not p_status = any (public.treatment_status_next(was.status))");
    refusesInOwnWords(change);
  });

  it("records a session from any visit of the patient, starting a planned or on-hold one (D248, D249)", () => {
    const record = functionBody(sql, "record_treatment_session");
    expect(record).toContain("public.visit_for_change(p_visit_id, 'visits.edit')");
    expect(record).toContain("if treatment.id is null or treatment.patient_id <> visit.patient_id then");
    expect(record).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'VISIT_CHANGED'/);
    expect(record).toMatch(
      /if treatment\.status in \('COMPLETED', 'CANCELLED'\) then\s+raise exception [^;]*'TREATMENT_CLOSED'/,
    );
    expect(record).toContain("set status = 'IN_PROGRESS', started_on = coalesce(started_on, visit.visit_date)");
    refusesInOwnWords(record);
  });

  it("removes a session only while its visit is open (D254)", () => {
    const remove = functionBody(sql, "remove_treatment_session");
    expect(remove).toContain("visit := public.visit_for_change(found.visit_id, 'visits.edit');");
    expect(remove).toMatch(/if visit\.status <> 'OPEN' then\s+raise exception [^;]*'TREATMENT_SESSION_KEPT'/);
    refusesInOwnWords(remove);
  });

  it("is called by members only", () => {
    for (const signature of [
      "create_treatment(jsonb, uuid)",
      "update_treatment(uuid, jsonb, jsonb)",
      "change_treatment_status(uuid, text, text, text)",
      "record_treatment_session(uuid, uuid, text, jsonb)",
      "remove_treatment_session(uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });
});

describe("0024 what a visit holds (D197, D226)", () => {
  it("counts a treatment started in it, or a session of one, as something recorded", () => {
    const recorded = functionBody(sql, "visit_recorded");
    expect(recorded).not.toContain("security definer");
    expect(recorded).toContain("treatment.clinic_id = p_visit.clinic_id and treatment.started_visit_id = p_visit.id");
    expect(recorded).toContain("session.clinic_id = p_visit.clinic_id and session.visit_id = p_visit.id");
  });
});

describe("0024 archiving a patient with an open treatment (D255)", () => {
  const check = functionBody(sql, "check_patient");

  it("is refused while one is open, named only to whoever reads treatments", () => {
    expect(openIn(check.slice(check.indexOf("from public.treatments")))).toEqual([...OPEN_TREATMENT_STATUSES]);
    expect(check).toContain("hint = 'PATIENT_HAS_TREATMENTS'");
    expect(check).toContain("'name', case when public.has_permission('visits.view') then open_treatment end");
    // 0017's refusal for an appointment to come stays, asked first.
    expect(check.indexOf("PATIENT_HAS_APPOINTMENTS")).toBeLessThan(check.indexOf("PATIENT_HAS_TREATMENTS"));
    refusesInOwnWords(check);
  });
});

describe("0024 policies (plan §27.4; D253)", () => {
  it("reads treatments with visits.view in the doctor scope, cost and all, and sessions with their treatment", () => {
    expect(sql).toContain("alter table public.treatments enable row level security;");
    expect(sql).toContain("alter table public.treatment_sessions enable row level security;");
    const read = policy("treatments_select");
    expect(read).toContain("(select public.has_permission('visits.view'))");
    expect(read).toContain(
      "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
    );
    expect(policy("treatment_sessions_select")).toContain(
      "exists (select 1 from public.treatments as treatment where treatment.id = treatment_id)",
    );
  });

  it("writes neither table but through its functions", () => {
    expect(sql).not.toMatch(/create policy \w+ on public\.treatment(s|_sessions)\s+for (insert|update|delete)/);
    expect(sql).toContain("grant select on public.treatments to authenticated;");
    expect(sql).toContain("grant select on public.treatment_sessions to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]* on public\.treatment/);
  });
});
