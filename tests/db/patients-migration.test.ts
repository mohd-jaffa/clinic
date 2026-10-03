import { describe, expect, it } from "vitest";

import { MAX_PATIENT_AGE, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { FIRST_PATIENT_NUMBER } from "@/constants/seeds";
import { ALERT_KINDS, GENDERS } from "@/constants/statuses";
import { checkedValues, cleanTextLimit, columnLine, functionBody, readMigration, tableBody } from "@tests/support/sql";

const sql = readMigration("0015_patients.sql");
const patients = tableBody(sql, "patients");
const alerts = tableBody(sql, "patient_alerts");
const access = tableBody(sql, "patient_doctors");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

describe("0015 adding or editing a patient needs seeing them (D102)", () => {
  it("gives anyone who could add or edit without seeing the permission to see", () => {
    expect(sql).toContain(
      "update public.clinic_members\n   set permissions = array_prepend('patients.view', permissions)\n where permissions && array['patients.create', 'patients.edit']::text[]\n   and not 'patients.view' = any (permissions);",
    );
    // The redefinition itself is held equal to PERMISSION_DEPENDENCIES by the catalogue's own test.
    expect(functionBody(sql, "permissions_are_valid")).toContain("('patients.create', 'patients.view'),");
  });
});

describe("0015 a patient (plan §10.1, §28.3)", () => {
  it("bounds every field as the patient form does", () => {
    expect(cleanTextLimit(sql, "patients", "full_name")).toBe(TEXT_LIMITS.personName);
    expect(cleanTextLimit(sql, "patients", "address")).toBe(TEXT_LIMITS.address);
    expect(cleanTextLimit(sql, "patients", "emergency_contact_name")).toBe(TEXT_LIMITS.personName);
    expect(cleanTextLimit(sql, "patients", "notes")).toBe(TEXT_LIMITS.notes);
    expect(columnLine(sql, "patients", "phone")).toContain("text not null check (public.is_indian_mobile(phone))");
    expect(columnLine(sql, "patients", "alt_phone")).toContain("public.is_phone_number(alt_phone)");
    expect(columnLine(sql, "patients", "emergency_contact_phone")).toContain(
      "public.is_phone_number(emergency_contact_phone)",
    );
    expect(columnLine(sql, "patients", "email")).toContain("public.is_email(email::text)");
    expect(checkedValues(patients, "gender")).toEqual([...GENDERS]);
  });

  it("requires what D33 requires, and no more", () => {
    for (const column of ["full_name", "phone", "date_of_birth", "gender"]) {
      expect(columnLine(sql, "patients", column), column).toContain("not null");
    }
    for (const column of ["alt_phone", "email", "address", "emergency_contact_name", "assigned_doctor_id", "notes"]) {
      expect(columnLine(sql, "patients", column), column).not.toContain("not null");
    }
    expect(columnLine(sql, "patients", "dob_is_estimated")).toContain("boolean not null default false");
  });

  it("hangs from the clinic, and names only a doctor of the same clinic", () => {
    expect(patients).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(patients).toContain(
      "foreign key (assigned_doctor_id, clinic_id) references public.doctors (id, clinic_id)\n    on delete set null (assigned_doctor_id)",
    );
    expect(patients).toContain("unique (id, clinic_id)");
  });

  it("is numbered from FIRST_PATIENT_NUMBER by the clinic's counter under a lock, once per clinic", () => {
    expect(patients).toContain("unique (clinic_id, patient_number)");
    expect(tableBody(sql, "patient_counters")).toContain(
      `last_number integer not null check (last_number >= ${FIRST_PATIENT_NUMBER})`,
    );
    const number = functionBody(sql, "number_patient");
    expect(number).toContain(`values (new.clinic_id, ${FIRST_PATIENT_NUMBER})`);
    expect(number).toContain("on conflict (clinic_id) do update set last_number = counter.last_number + 1");
    expect(number).toContain("returning counter.last_number into new.patient_number;");
    expect(sql).toContain(
      "create trigger number_patient before insert on public.patients\nfor each row execute function public.number_patient();",
    );
  });

  it("keeps an archived patient read-only until restored, and stamps who archived them (D103)", () => {
    const check = functionBody(sql, "check_patient");
    expect(check).toContain("if old.archived_at is not null and new.archived_at is not null then");
    expect(check).toContain("new.archived_at := case when new.archived_at is not null then now() end;");
    expect(check).toContain("new.archived_by := case when new.archived_at is not null then auth.uid() end;");
    expect(patients).toContain("check (archived_by is null or archived_at is not null)");
  });

  it(`takes a date of birth from today back ${MAX_PATIENT_AGE} years, in the clinic's timezone, when given`, () => {
    const check = functionBody(sql, "check_patient");
    expect(check).toContain("today date := public.clinic_today(new.clinic_id);");
    expect(check).toContain(
      `if born_given and (new.date_of_birth > today or new.date_of_birth < (today - interval '${MAX_PATIENT_AGE} years')::date) then`,
    );
    expect(check).toContain("born_given := new.date_of_birth is distinct from old.date_of_birth;");
  });

  it("takes as assigned doctor only one of the clinic's active doctors, when chosen", () => {
    const check = functionBody(sql, "check_patient");
    expect(check).toContain("doctor_given := new.assigned_doctor_id is distinct from old.assigned_doctor_id;");
    expect(check).toContain("where doctor.id = new.assigned_doctor_id and doctor.active and member.status = 'ACTIVE'");
  });

  it("records who wrote it, and when", () => {
    expect(sql).toContain(
      "create trigger set_patients_actor before insert or update on public.patients\nfor each row execute function public.set_actor();",
    );
    expect(sql).toContain(
      "create trigger set_patients_updated_at before update on public.patients\nfor each row execute function public.set_updated_at();",
    );
    for (const column of ["created_by", "updated_by", "archived_by"]) {
      expect(columnLine(sql, "patients", column), column).toContain(
        "references public.profiles (id) on delete set null",
      );
    }
  });

  it("has the indexes its list, its search and its mobile hint read", () => {
    expect(sql).toContain("on public.patients (clinic_id, archived_at);");
    expect(sql).toContain("on public.patients (clinic_id, phone);");
    expect(sql).toContain("using gist (clinic_id, full_name extensions.gist_trgm_ops);");
    expect(sql).toContain("using gist (clinic_id, phone extensions.gist_trgm_ops);");
  });
});

describe("0015 the doctor scope (plan §27.2, §27.3; D3, D99)", () => {
  it("lists a patient's doctors once each, within the clinic, gone with the patient or the doctor", () => {
    expect(access).toContain("primary key (patient_id, doctor_id)");
    expect(access).toContain(
      "foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete cascade",
    );
    expect(access).toContain(
      "foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade",
    );
    expect(sql).toContain("on public.patient_doctors (clinic_id, doctor_id, patient_id);");
  });

  it("grows by trigger: the assigned doctor, and the doctor who added the patient; never shrinks", () => {
    const add = functionBody(sql, "add_patient_doctors");
    expect(add).toContain("new.assigned_doctor_id,");
    expect(add).toContain("case when tg_op = 'INSERT' then public.current_doctor_id() end");
    expect(add).toContain("on conflict do nothing;");
    expect(sql).toContain(
      "create trigger add_patient_doctors after insert or update of assigned_doctor_id on public.patients\nfor each row execute function public.add_patient_doctors();",
    );
    expect(sql).not.toMatch(/delete from public\.patient_doctors/);
  });

  it("lets the owner and staff see every patient, a doctor only their own, and only with patients.view", () => {
    expect(functionBody(sql, "sees_every_patient")).toContain(
      "select coalesce((select member.role <> 'DOCTOR' from public.current_member() as member), false);",
    );
    expect(functionBody(sql, "doctor_patient_ids")).toContain(
      "and access.doctor_id = (select public.current_doctor_id());",
    );
    const can = functionBody(sql, "can_see_patient");
    expect(can).toContain("select public.has_permission('patients.view')");
    expect(can).toContain("where patient.id = p_patient_id and patient.clinic_id = public.current_clinic_id()");
    expect(can).toContain("public.sees_every_patient()");
    expect(can).toContain("where access.patient_id = p_patient_id and access.doctor_id = public.current_doctor_id()");
    for (const helper of ["sees_every_patient", "doctor_patient_ids", "can_see_patient"]) {
      expect(functionBody(sql, helper), helper).toContain("stable\nsecurity definer\nset search_path = ''");
    }
  });

  it("reads the patients through the scope, and changes them with patients.edit while the clinic can write", () => {
    const scope = "((select public.sees_every_patient()) or id in (select public.doctor_patient_ids()))";
    const select = policy("patients_select");
    expect(select).toContain("(select public.has_permission('patients.view'))");
    expect(select).toContain(scope);
    const update = policy("patients_update");
    expect(update).toContain("(select public.has_permission('patients.edit'))");
    expect(update).toContain(scope);
    expect(update).toContain("(select public.clinic_can_write())");
  });

  it("keeps the counter and the access list from every client", () => {
    expect(sql).toContain("alter table public.patient_counters enable row level security;");
    expect(sql).toContain("alter table public.patient_doctors enable row level security;");
    expect(sql).not.toMatch(/create policy \w+ on public\.(patient_counters|patient_doctors)/);
    expect(sql).not.toMatch(/grant [^;]* on [^;]*public\.(patient_counters|patient_doctors)/);
  });
});

describe("0015 alerts (plan §10.4)", () => {
  it("knows the kinds the app knows, bounds the label and note, and hangs from the patient", () => {
    expect(checkedValues(alerts, "kind")).toEqual([...ALERT_KINDS]);
    expect(cleanTextLimit(sql, "patient_alerts", "label")).toBe(TEXT_LIMITS.alertLabel);
    expect(cleanTextLimit(sql, "patient_alerts", "note")).toBe(TEXT_LIMITS.alertNote);
    expect(alerts).toContain(
      "foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete cascade",
    );
    expect(sql).toContain(
      "create unique index patient_alerts_label_unique on public.patient_alerts (patient_id, kind, lower(label)) where active;",
    );
  });

  it("is read with visits.view and written with visits.edit, within the doctor scope, while the clinic can write", () => {
    expect(policy("patient_alerts_select")).toContain("(select public.has_permission('visits.view'))");
    for (const name of ["patient_alerts_select", "patient_alerts_insert", "patient_alerts_update"]) {
      expect(policy(name), name).toContain(
        "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
      );
    }
    for (const name of ["patient_alerts_insert", "patient_alerts_update"]) {
      expect(policy(name), name).toContain("(select public.has_permission('visits.edit'))");
      expect(policy(name), name).toContain("(select public.clinic_can_write())");
    }
  });

  it("is read-only while its patient is archived (D103), and records who wrote it", () => {
    expect(functionBody(sql, "check_patient_alert")).toContain(
      "where patient.id = new.patient_id and patient.archived_at is not null",
    );
    expect(sql).toContain(
      "create trigger set_patient_alerts_actor before insert or update on public.patient_alerts\nfor each row execute function public.set_actor();",
    );
  });
});

describe("0015 adding a patient, and finding one", () => {
  it("adds one with patients.create while the clinic can write, the number and clinic its own", () => {
    const create = functionBody(sql, "create_patient");
    expect(create).toContain("if clinic is null or not public.has_permission('patients.create') then");
    expect(create).toContain("perform public.require_clinic_write(clinic);");
    expect(create).toContain("from jsonb_populate_record(null::public.patients, p_patient) as given");
    expect(create).not.toMatch(/given\.(patient_number|clinic_id|archived_at|created_by)/);
    expect(sql).toContain("grant execute on function public.create_patient(jsonb) to authenticated;");
  });

  it("imports a batch as the owner alone while the clinic can write, numbered in the order given (D51)", () => {
    const imported = functionBody(sql, "import_patients");
    expect(imported).toContain("if clinic is null or not public.is_clinic_owner() then");
    expect(imported).toContain("perform public.require_clinic_write(clinic);");
    expect(imported).toContain(
      "from jsonb_populate_recordset(null::public.patients, p_patients) with ordinality as given\n     order by given.ordinality",
    );
    expect(imported).not.toMatch(/given\.(patient_number|clinic_id|archived_at|created_by|assigned_doctor_id)/);
    expect(sql).toContain("grant execute on function public.import_patients(jsonb) to authenticated;");
  });

  it("searches as the caller, so the doctor scope holds, best match first and newest first among equals (D104)", () => {
    const search = functionBody(sql, "search_patients");
    expect(search).not.toContain("security definer");
    expect(search).toContain("and (patient.archived_at is not null) = p_archived");
    expect(search).toContain("p_words operator(extensions.<%) patient.full_name");
    expect(search).toMatch(
      /order by\s+coalesce\(patient\.patient_number = p_number, false\) desc,\s+coalesce\(patient\.phone like[^,]*, false\) desc,[\s\S]*patient\.patient_number desc\s+offset p_offset\s+limit p_limit;/,
    );
    expect(sql).toContain(
      "grant execute on function public.search_patients(text, text, integer, boolean, integer, integer) to authenticated;",
    );
  });

  it("is never deleted or numbered by a client, and an alert never deleted", () => {
    expect(sql).not.toMatch(
      /create policy [^;]*for (insert|delete)[^;]*on public\.patients|on public\.patients\s+for (insert|delete)/,
    );
    expect(sql).not.toMatch(/create policy \w+ on public\.\w+\s+for delete/);
    const update = /grant update \(([\s\S]*?)\) on public\.patients to authenticated;/.exec(sql)![1];
    expect(update).not.toMatch(/patient_number|clinic_id|archived_by|created_by/);
    expect(sql).toContain("grant update (label, note, active) on public.patient_alerts to authenticated;");
    expect(sql).toContain("grant select on public.patients, public.patient_alerts to authenticated;");
  });

  it("refuses with the app's own codes", () => {
    const codes = [...new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]))];
    expect(codes).toEqual([
      "PATIENT_ARCHIVED",
      "PATIENT_BIRTH_DATE_INVALID",
      "DOCTOR_INACTIVE",
      "AUTH_PERMISSION_DENIED",
    ]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
  });
});
