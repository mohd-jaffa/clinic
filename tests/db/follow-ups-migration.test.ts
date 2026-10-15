import { describe, expect, it } from "vitest";

import { FOLLOW_UP_WINDOW_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { FOLLOW_UP_OUTCOMES, FOLLOW_UP_TABS, OPEN_TREATMENT_STATUSES } from "@/constants/statuses";
import {
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0026_follow_ups.sql");
const contacts = tableBody(sql, "follow_up_contacts");
const rows = functionBody(sql, "follow_up_rows");

/** Every refusal a function raises is one of the app's own codes. */
function refusesInOwnWords(body: string) {
  for (const hint of quoted(body.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
    expect(isErrorMessageCode(hint), hint).toBe(true);
  }
}

describe("0026 when a treatment's next due day was set (D268)", () => {
  it("is stamped whenever the day is given or changed, cleared with it, after check_treatment", () => {
    expect(sql).toContain("alter table public.treatments add column next_due_set_at timestamptz;");
    expect(sql).toContain("check ((next_due_on is null) = (next_due_set_at is null))");
    const stamp = functionBody(sql, "stamp_treatment_next_due");
    expect(stamp).toContain("if tg_op = 'INSERT' or new.next_due_on is distinct from old.next_due_on then");
    expect(stamp).toContain("new.next_due_set_at := case when new.next_due_on is not null then now() end;");
    // Before-triggers fire by name: check_treatment closes it first.
    expect("stamp_treatment_next_due" > "check_treatment").toBe(true);
    expect(sql).toContain("create trigger stamp_treatment_next_due before insert or update on public.treatments");
  });
});

describe("0026 a contact (D271)", () => {
  it("is about one follow-up of the clinic's own patient, with an outcome the app knows", () => {
    expect(contacts).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(contacts).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id)");
    expect(contacts).toContain("foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id)");
    expect(contacts).toContain("foreign key (visit_id, clinic_id) references public.visits (id, clinic_id)");
    expect(contacts).toContain("check ((treatment_id is null) <> (visit_id is null))");
    expect(checkedValues(contacts, "outcome")).toEqual([...FOLLOW_UP_OUTCOMES]);
    expect(cleanTextLimit(sql, "follow_up_contacts", "note")).toBe(TEXT_LIMITS.contactNote);
    expect(columnLine(sql, "follow_up_contacts", "contacted_by")).toContain(
      "references public.profiles (id) on delete set null",
    );
  });

  it("is read by whoever works the follow-ups within the doctor scope, and written only by its function", () => {
    expect(sql).toContain("alter table public.follow_up_contacts enable row level security;");
    const read = /create policy follow_up_contacts_select [\s\S]*?;/.exec(sql)![0];
    expect(read).toContain("(select public.works_follow_ups())");
    expect(read).toContain(
      "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
    );
    expect(functionBody(sql, "works_follow_ups")).toContain(
      "public.has_permission('appointments.view') or public.has_permission('visits.view')",
    );
    expect(sql).not.toMatch(/create policy \w+ on public\.follow_up_contacts\s+for (insert|update|delete)/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]* on public\.follow_up_contacts/);
  });
});

describe("0026 the follow-ups (plan §14.2, §14.3; D267 – D271)", () => {
  it("are open treatments' next due days — on hold too — and visits' follow-ups, within the doctor scope", () => {
    expect(quoted(/treatment\.status in \(([^)]*)\)/.exec(rows)![1])).toEqual([...OPEN_TREATMENT_STATUSES]);
    expect(rows).toContain("and visit.follow_up_on is not null");
    expect(rows).toContain(
      "where ((select public.sees_every_patient()) or due.patient_id in (select public.doctor_patient_ids()))",
    );
    expect(rows).toContain(
      "join public.patients as patient on patient.id = tabbed.patient_id and patient.archived_at is null",
    );
  });

  it("are done by an appointment for a later day, to come or kept, or by a later visit (D268)", () => {
    expect(rows).toContain("and appointment.local_date > (due.set_at at time zone clinic.timezone)::date");
    expect(rows).toContain("appointment.status = 'COMPLETED'");
    expect(rows).toContain(
      "or (appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')\n                  and appointment.local_date >= clinic.today)",
    );
    expect(rows).toContain("and later.created_at > due.set_at");
  });

  it("fall in their tab by the clinic's today, the lapsed days setting and the window (D270)", () => {
    expect(rows).toContain("(now() at time zone clinic.timezone)::date as today");
    expect(rows).toContain("settings.follow_up_lapsed_days as lapsed");
    const windows = [...rows.matchAll(/clinic\.today ([+-]) (\d+)/g)].map(([, , days]) => Number(days));
    expect(windows).toEqual([FOLLOW_UP_WINDOW_DAYS, FOLLOW_UP_WINDOW_DAYS]);
    expect(rows).toContain(
      "when pending.due_on < clinic.today and pending.due_on >= clinic.today - clinic.lapsed then 'OVERDUE'",
    );
    expect(rows).toContain("when pending.due_on < clinic.today - clinic.lapsed then 'LAPSED'");
    const tabs = [...rows.matchAll(/then '([A-Z_]+)'/g)].map(([, tab]) => tab);
    expect(rows).toContain("'COMPLETED' as tab");
    expect(new Set([...tabs, "COMPLETED"])).toEqual(new Set(FOLLOW_UP_TABS));
  });

  it("leave out one snoozed till a later day, from the lists and the counts alike (D271)", () => {
    expect(rows).toContain(
      "and (tabbed.tab = 'COMPLETED' or contact.snooze_until is null or contact.snooze_until <= clinic.today);",
    );
    expect(functionBody(sql, "follow_up_counts")).toContain(
      "left join public.follow_up_rows() as row on row.tab = tabs.tab",
    );
  });

  it("are listed and counted for whoever sees appointments or visits (D267), each tab one the app knows", () => {
    const [items, counts] = [functionBody(sql, "follow_up_items"), functionBody(sql, "follow_up_counts")];
    for (const body of [items, counts]) {
      expect(body).toContain("if public.current_clinic_id() is null or not public.works_follow_ups() then");
      refusesInOwnWords(body);
    }
    expect(quoted(/p_tab not in \(([^)]*)\)/.exec(items)![1])).toEqual([...FOLLOW_UP_TABS]);
    expect(quoted(/unnest\(array\[([^\]]*)\]\)/.exec(counts)![1])).toEqual([...FOLLOW_UP_TABS]);
    expect(sql).toContain("revoke all on function public.follow_up_rows() from public, anon, authenticated;");
  });

  it("are read on indexes led by the clinic (plan §37.1)", () => {
    for (const index of [
      "on public.treatments (clinic_id, next_due_on) where next_due_on is not null;",
      "on public.visits (clinic_id, follow_up_on) where follow_up_on is not null;",
      "on public.treatments (clinic_id, completed_on desc) where completed_on is not null;",
      "on public.follow_up_contacts (clinic_id, treatment_id, contacted_at desc) where treatment_id is not null;",
      "on public.follow_up_contacts (clinic_id, visit_id, contacted_at desc) where visit_id is not null;",
      "on public.follow_up_contacts (clinic_id, patient_id, contacted_at desc);",
      "create index follow_up_contacts_contacted_by_idx on public.follow_up_contacts (contacted_by);",
    ]) {
      expect(sql).toContain(index);
    }
  });
});

describe("0026 record_follow_up_contact (D267, D271)", () => {
  const record = functionBody(sql, "record_follow_up_contact");

  it("notes one by appointments.edit or visits.edit, while the clinic writes, for a patient seen and not archived", () => {
    expect(record).toContain(
      "if clinic is null or not (public.has_permission('appointments.edit') or public.has_permission('visits.edit')) then",
    );
    expect(record).toContain("perform public.require_clinic_write(clinic);");
    expect(record).toContain("if patient is null or not public.can_see_patient(patient) then");
    expect(record).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(record).toContain("if snooze is not null and snooze <= public.clinic_today(clinic) then");
    expect(record).toContain("auth.uid()");
    refusesInOwnWords(record);
    expect(sql).toContain("grant execute on function public.record_follow_up_contact(jsonb) to authenticated;");
  });
});
