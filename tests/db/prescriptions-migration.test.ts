import { describe, expect, it } from "vitest";

import { PRESCRIPTION_DAYS, VITAL_SIGNS } from "@/constants/clinical";
import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { PRESCRIPTION_TIMINGS } from "@/constants/statuses";
import { VITAL_COLUMNS } from "@/features/visits/vitals";
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

const sql = readMigration("0021_prescriptions.sql");
const prescriptions = tableBody(sql, "prescriptions");
const items = tableBody(sql, "prescription_items");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

describe("0021 a prescription (plan §13, §28.5)", () => {
  it("hangs from the clinic: one for a visit, naming the clinic's own patient and doctor", () => {
    expect(prescriptions).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(prescriptions).toContain("visit_id uuid not null unique,");
    expect(prescriptions).toContain("foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),");
    expect(prescriptions).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),");
    expect(prescriptions).toContain("foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id)");
    expect(prescriptions).toContain("unique (id, clinic_id)");
  });

  it("bounds its advice, prints the diagnosis only once ticked (D216), and keeps who typed it (D45)", () => {
    expect(cleanTextLimit(sql, "prescriptions", "advice")).toBe(TEXT_LIMITS.advice);
    expect(columnLine(sql, "prescriptions", "advice")).toContain("is_clean_text");
    expect(columnLine(sql, "prescriptions", "print_diagnosis")).toContain("boolean not null default false");
    for (const actor of ["entered_by", "created_by", "updated_by"]) {
      expect(columnLine(sql, "prescriptions", actor)).toContain("references public.profiles (id) on delete set null");
    }
    expect(sql).toContain("create trigger set_prescriptions_actor before insert or update on public.prescriptions");
    expect(sql).toContain("create trigger set_prescriptions_updated_at before update on public.prescriptions");
  });
});

describe("0021 a prescription's medicines", () => {
  it("are bounded as the screen bounds them, the timing one of PRESCRIPTION_TIMINGS", () => {
    expect(cleanTextLimit(sql, "prescription_items", "medicine")).toBe(TEXT_LIMITS.medicine);
    expect(columnLine(sql, "prescription_items", "medicine")).toContain("text not null");
    expect(cleanTextLimit(sql, "prescription_items", "strength")).toBe(TEXT_LIMITS.strength);
    expect(cleanTextLimit(sql, "prescription_items", "dose")).toBe(TEXT_LIMITS.dose);
    expect(cleanTextLimit(sql, "prescription_items", "frequency")).toBe(TEXT_LIMITS.frequency);
    expect(cleanTextLimit(sql, "prescription_items", "instructions")).toBe(TEXT_LIMITS.instructions);
    expect(checkedValues(items, "timing")).toEqual([...PRESCRIPTION_TIMINGS]);
    expect(betweenBounds(sql, "prescription_items", "duration_days")).toEqual(PRESCRIPTION_DAYS);
    expect(betweenBounds(sql, "prescription_items", "position")).toEqual({ min: 1, max: PRESCRIPTION_MAX_ITEMS });
  });

  it("go with their prescription, in order", () => {
    expect(items).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(items).toContain(
      "foreign key (prescription_id, clinic_id) references public.prescriptions (id, clinic_id) on delete cascade",
    );
    expect(items).toContain("unique (prescription_id, position),");
  });
});

describe("0021 indexes (plan §37.1)", () => {
  it("lead with the clinic for every read, and cover each foreign key", () => {
    for (const index of [
      "create index prescriptions_clinic_id_patient_id_idx on public.prescriptions (clinic_id, patient_id, created_at desc);",
      "create index prescriptions_clinic_id_doctor_id_idx on public.prescriptions (clinic_id, doctor_id);",
      "create index prescriptions_entered_by_idx on public.prescriptions (entered_by);",
      "create index prescriptions_created_by_idx on public.prescriptions (created_by);",
      "create index prescriptions_updated_by_idx on public.prescriptions (updated_by);",
    ]) {
      expect(sql).toContain(index);
    }
  });

  it("serve the suggestions by what a medicine begins with (D211)", () => {
    expect(sql).toContain("on public.prescription_items (clinic_id, lower(medicine) text_pattern_ops);");
    expect(functionBody(sql, "medicine_suggestions")).toContain(
      "where item.clinic_id = clinic and lower(item.medicine) like prefix || '%'",
    );
  });
});

describe("0021 what counts as recorded (D197)", () => {
  it("is a prescription with a medicine or advice, beside the notes and a reading", () => {
    const empty = functionBody(sql, "visit_is_empty");
    for (const sign of VITAL_SIGNS) expect(empty).toContain(`vital.${VITAL_COLUMNS[sign]} is not null`);
    expect(empty).toContain("prescription.advice is not null");
    expect(empty).toContain(
      "exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id)",
    );
  });

  it("has Back to waiting remove an emptied prescription with its empty visit", () => {
    expect(functionBody(sql, "back_to_waiting")).toMatch(
      /public\.visit_is_empty\(visit\) then\s+delete from public\.prescriptions where visit_id = visit;\s+delete from public\.vitals where visit_id = visit;\s+delete from public\.visits where id = visit;/,
    );
  });
});

describe("0021 save_prescription (D210, D213, D215, D206)", () => {
  const save = functionBody(sql, "save_prescription");

  it("writes the clinic's visit, within the doctor scope, while the clinic can write", () => {
    expect(save).toContain("perform public.require_clinic_write(clinic);");
    expect(save).toContain("for update;");
    expect(save).toContain("not public.can_see_patient(visit.patient_id)");
  });

  it("is the visit's doctor's, or prescriptions.write's — open or done alike (D215)", () => {
    expect(save).toContain("public.current_doctor_id() is distinct from visit.doctor_id");
    expect(save).toContain("and not public.has_permission('prescriptions.write')");
    expect(save).not.toContain("visit.status");
  });

  it("refuses an archived patient, a doctor with no registration number, and too many medicines", () => {
    expect(save).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(save).toContain("doctor.registration_number is not null");
    expect(save).toContain("hint = 'PRESCRIPTION_NEEDS_REGISTRATION'");
    expect(save).toContain(`jsonb_array_length(items) > ${PRESCRIPTION_MAX_ITEMS}`);
  });

  it("saves from the copy read, in the doctor's name, and writes the medicines again only when they changed", () => {
    expect(save).toMatch(/if before is distinct from p_seen then\s+raise exception [^;]*'VISIT_CHANGED'/);
    expect(save).toContain("visit.clinic_id, visit.patient_id, visit.id, visit.doctor_id");
    expect(save).toContain("on conflict (visit_id) do update");
    expect(save).toContain("entered_by = excluded.entered_by");
    expect(save).toMatch(
      /if before is null or before -> 'items' is distinct from items then\s+delete from public\.prescription_items/,
    );
    expect(save).toContain("from jsonb_array_elements(items) with ordinality as line(item, position);");
  });

  it("refuses only in the app's own words", () => {
    for (const hint of quoted(save.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
      expect(isErrorMessageCode(hint)).toBe(true);
    }
  });
});

describe("0021 medicine_suggestions (D211)", () => {
  const suggest = functionBody(sql, "medicine_suggestions");

  it("is for a doctor, or whoever types for one", () => {
    expect(suggest).toContain(
      "public.current_doctor_id() is null and not public.has_permission('prescriptions.write')",
    );
  });

  it("takes what is typed literally, and gives one line for each medicine and strength, the doctor's own first", () => {
    expect(suggest).toContain("'\\', '\\\\'), '%', '\\%'), '_', '\\_')");
    expect(suggest).toContain("select distinct on (lower(item.medicine), lower(coalesce(item.strength, '')))");
    expect(suggest).toContain("prescription.doctor_id = p_doctor_id desc, item.created_at desc");
    expect(suggest).toContain("order by line.own desc, line.written desc");
    expect(suggest).toContain("limit 8;");
  });
});

describe("0021 policies and grants (plan §27.4)", () => {
  it("reads a prescription with visits.view within the doctor scope, its medicines with it", () => {
    expect(sql).toContain("alter table public.prescriptions enable row level security;");
    expect(sql).toContain("alter table public.prescription_items enable row level security;");
    const read = policy("prescriptions_select");
    expect(read).toContain("clinic_id = (select public.current_clinic_id())");
    expect(read).toContain("(select public.has_permission('visits.view'))");
    expect(read).toContain(
      "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
    );
    expect(policy("prescription_items_select")).toContain(
      "exists (select 1 from public.prescriptions as prescription where prescription.id = prescription_id)",
    );
  });

  it("writes only through save_prescription; members call it and the suggestions, nothing reaches the helper", () => {
    expect(sql).toContain("grant select on public.prescriptions to authenticated;");
    expect(sql).toContain("grant select on public.prescription_items to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)/);
    for (const name of ["save_prescription(uuid, jsonb, jsonb)", "medicine_suggestions(text, uuid)"]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${name} to authenticated;`);
    }
    expect(sql).toContain("revoke all on function public.prescription_of(uuid) from public, anon, authenticated;");
  });
});
