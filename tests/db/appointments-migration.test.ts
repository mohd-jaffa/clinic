import { describe, expect, it } from "vitest";

import { APPOINTMENT_MINUTES, APPOINTMENT_STEP_MINUTES, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUS_TRANSITIONS,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
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

const sql = readMigration("0017_appointments.sql");
const appointments = tableBody(sql, "appointments");
const tokens = tableBody(sql, "daily_tokens");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

describe("0017 an appointment (plan §11.1, §28.4)", () => {
  it("holds the vocabularies the app knows, and a length within APPOINTMENT_MINUTES", () => {
    expect(checkedValues(appointments, "source")).toEqual([...APPOINTMENT_SOURCES]);
    expect(checkedValues(appointments, "status")).toEqual([...APPOINTMENT_STATUSES]);
    expect(betweenBounds(sql, "appointments", "duration_minutes")).toEqual(APPOINTMENT_MINUTES);
    expect(columnLine(sql, "appointments", "status")).toContain("default 'SCHEDULED'");
  });

  it("bounds its notes and a cancellation's reason as the forms will", () => {
    expect(cleanTextLimit(sql, "appointments", "notes")).toBe(TEXT_LIMITS.notes);
    expect(cleanTextLimit(sql, "appointments", "cancel_reason")).toBe(TEXT_LIMITS.reason);
  });

  it(`starts a booking on the clinic's ${APPOINTMENT_STEP_MINUTES}-minute steps, and a walk-in at now`, () => {
    expect(appointments).toContain(
      `check (source = 'WALK_IN' or extract(epoch from scheduled_at) % ${APPOINTMENT_STEP_MINUTES * 60} = 0)`,
    );
    expect(functionBody(sql, "check_booking")).toContain(
      `to_timestamp(floor(extract(epoch from now()) / ${APPOINTMENT_STEP_MINUTES * 60}) * ${APPOINTMENT_STEP_MINUTES * 60})`,
    );
  });

  it("hangs from the clinic, and names only the clinic's own patient, doctor and type — never removed under it", () => {
    expect(appointments).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(appointments).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),");
    expect(appointments).toContain("foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),");
    expect(appointments).toContain(
      "foreign key (appointment_type_id, clinic_id) references public.appointment_types (id, clinic_id),",
    );
    expect(sql).toContain(
      "alter table public.appointment_types add constraint appointment_types_id_clinic_unique unique (id, clinic_id);",
    );
    expect(appointments).toContain("unique (id, clinic_id)");
  });

  it("is cancelled with a reason, stamped with when and by whom", () => {
    expect(appointments).toContain(
      "(status = 'CANCELLED') = (cancelled_at is not null) and (cancelled_at is null or cancel_reason is not null)",
    );
    const check = functionBody(sql, "check_appointment");
    expect(check).toContain("new.cancelled_at := now();");
    expect(check).toContain("new.cancelled_by := auth.uid();");
  });

  it("sets its day in the clinic's timezone, and records who wrote it, and when", () => {
    expect(functionBody(sql, "check_appointment")).toContain(
      "select (new.scheduled_at at time zone clinic.timezone)::date into new.local_date",
    );
    expect(sql).toContain(
      "create trigger check_appointment before insert or update on public.appointments\nfor each row execute function public.check_appointment();",
    );
    expect(sql).toContain(
      "create trigger set_appointments_actor before insert or update on public.appointments\nfor each row execute function public.set_actor();",
    );
    expect(sql).toContain(
      "create trigger set_appointments_updated_at before update on public.appointments\nfor each row execute function public.set_updated_at();",
    );
    for (const column of ["created_by", "updated_by", "cancelled_by"]) {
      expect(columnLine(sql, "appointments", column), column).toContain(
        "references public.profiles (id) on delete set null",
      );
    }
  });

  it("is made once per idempotency key", () => {
    expect(appointments).toContain("unique (clinic_id, idempotency_key)");
    for (const name of ["create_appointment", "add_walk_in"]) {
      const made = functionBody(sql, name);
      expect(made, name).toContain("hint = 'IDEMPOTENCY_KEY_REQUIRED'");
      expect(made, name).toContain(
        "perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));",
      );
      expect(made, name).toContain("return query select");
    }
  });
});

describe("0017 no double-booking (plan §11.1, D7)", () => {
  it("refuses an overlapping live booking of the same doctor in the database, never by reading first", () => {
    expect(appointments).toMatch(
      /constraint appointments_no_double_booking exclude using gist \(\s*doctor_id with =,\s*public\.appointment_slot\(scheduled_at, duration_minutes\) with &&\s*\) where \(source = 'BOOKED' and status not in \('CANCELLED', 'NO_SHOW'\)\)/,
    );
  });

  it("holds a slot from its start up to, not including, its end — immutable, and never inlined", () => {
    const slot = functionBody(sql, "appointment_slot");
    expect(slot).toContain("immutable");
    expect(slot).toContain("set search_path = ''");
    expect(slot).toContain("tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_minutes), '[)')");
  });

  it("answers a clash with the time it clashed with, never whose it is", () => {
    const taken = functionBody(sql, "raise_slot_taken");
    expect(taken).toContain("hint = 'APPOINTMENT_SLOT_TAKEN'");
    expect(taken).toContain("'startsAt', clash.scheduled_at,");
    expect(taken).not.toContain("patient");
    for (const name of ["create_appointment", "update_appointment", "mark_arrived"]) {
      expect(functionBody(sql, name), name).toMatch(
        /exception\s+when exclusion_violation then\s+perform public\.raise_slot_taken\(/,
      );
    }
  });
});

describe("0017 statuses (plan §11.2, D138)", () => {
  it("moves a status only as APPOINTMENT_STATUS_TRANSITIONS says", () => {
    const next = functionBody(sql, "appointment_status_next");
    const table = Object.fromEntries(
      [...next.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)].map(([, from, to]) => [from, quoted(to)]),
    ) as Record<AppointmentStatus, string[]>;
    expect(table).toEqual(APPOINTMENT_STATUS_TRANSITIONS);
    expect(functionBody(sql, "check_appointment")).toContain(
      "if new.status is distinct from old.status and not new.status = any (public.appointment_status_next(old.status)) then",
    );
  });

  it("changes here only to scheduled, confirmed, cancelled or a no-show; a walk-in is never scheduled", () => {
    const change = functionBody(sql, "change_appointment_status");
    expect(change).toContain("p_status not in ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'NO_SHOW')");
    expect(change).toContain("(was.source = 'WALK_IN' and p_status in ('SCHEDULED', 'CONFIRMED'))");
    expect(change).toContain(
      "case when p_status = 'CANCELLED' then 'appointments.cancel' else 'appointments.edit' end",
    );
    expect(change).toContain("hint = 'APPOINTMENT_CANCEL_REASON_REQUIRED'");
  });
});

describe("0017 tokens (plan §11.3, D141, D143)", () => {
  it("counts each doctor's day under a row lock, never max() + 1", () => {
    expect(tokens).toContain("primary key (doctor_id, day)");
    expect(tokens).toContain("last_token integer not null check (last_token >= 1)");
    expect(tokens).toContain(
      "foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade",
    );
    const next = functionBody(sql, "next_token");
    expect(next).toContain("on conflict (doctor_id, day) do update set last_token = counter.last_token + 1");
    expect(appointments).toContain("unique (doctor_id, local_date, token_number)");
    expect(sql).not.toMatch(/max\(\s*token_number\s*\)/);
  });

  it("keeps a token for the day, and gives it back when the appointment moves to another day or doctor", () => {
    expect(functionBody(sql, "mark_arrived")).toContain("if token is null then");
    expect(functionBody(sql, "check_appointment")).toContain(
      "if new.doctor_id is distinct from old.doctor_id or new.local_date is distinct from old.local_date then\n      new.token_number := null;",
    );
  });

  it("arrives a patient only on the appointment's own day", () => {
    expect(functionBody(sql, "mark_arrived")).toContain("if was.local_date <> public.clinic_today(was.clinic_id) then");
  });
});

describe("0017 booking, moving and walk-ins (plan §11.1, §11.3; D103, D139, D142)", () => {
  it("asks every booking, move and walk-in the same: the patient seen and not archived, the doctor active, the type active, the day open", () => {
    const check = functionBody(sql, "check_booking");
    expect(check).toContain("not public.can_see_patient(p_patient_id)");
    expect(check).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(check).toContain("doctor.active and member.status = 'ACTIVE'");
    expect(check).toContain("type.active");
    expect(check).toContain("and (c.doctor_id is null or c.doctor_id = p_doctor_id)");
    expect(check).toContain("hint = 'APPOINTMENT_ON_CLOSED_DAY'");
    expect(functionBody(sql, "create_appointment")).toContain("given.scheduled_at, true");
    expect(functionBody(sql, "add_walk_in")).toContain(
      "given.patient_id, given.doctor_id, given.appointment_type_id, now(), false",
    );
  });

  it("moves only a booking not yet arrived, and schedules a confirmed one moved again", () => {
    const update = functionBody(sql, "update_appointment");
    expect(update).toContain("if was.source <> 'BOOKED' or was.status not in ('SCHEDULED', 'CONFIRMED') then");
    expect(update).toContain("now_is.status := 'SCHEDULED';");
    expect(update).toContain(
      "where name <> all (array['doctor_id', 'appointment_type_id', 'scheduled_at', 'duration_minutes', 'notes'])",
    );
  });

  it("changes only an appointment of the caller's clinic, of a patient they may see, with its permission, while the clinic can write", () => {
    const change = functionBody(sql, "appointment_for_change");
    expect(change).toContain("not public.has_permission(p_permission)");
    expect(change).toContain("perform public.require_clinic_write(clinic);");
    expect(change).toContain("where appointment.id = p_appointment_id and appointment.clinic_id = clinic");
    expect(change).toContain("for update;");
    expect(change).toContain("not public.can_see_patient(found.patient_id)");
    for (const name of ["create_appointment", "add_walk_in"]) {
      const made = functionBody(sql, name);
      expect(made, name).toContain("not public.has_permission('appointments.create')");
      expect(made, name).toContain("perform public.require_clinic_write(clinic);");
    }
  });

  it("grows the doctor scope with each appointment's doctor; never shrinks it", () => {
    expect(functionBody(sql, "add_appointment_doctor")).toContain("on conflict do nothing;");
    expect(sql).toContain(
      "create trigger add_appointment_doctor after insert or update of doctor_id on public.appointments\nfor each row execute function public.add_appointment_doctor();",
    );
    expect(sql).not.toMatch(/delete from public\.patient_doctors/);
  });
});

describe("0017 archiving a patient with appointments to come (D140)", () => {
  it("is refused, naming when the first is; one left on a past day does not count", () => {
    const check = functionBody(sql, "check_patient");
    expect(check).toContain(
      "(appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED') and appointment.local_date >= today)",
    );
    expect(check).toContain("or appointment.status = 'IN_PROGRESS'");
    expect(check).toContain("hint = 'PATIENT_HAS_APPOINTMENTS'");
    expect(check).toContain("detail = json_build_object('scheduledAt', upcoming)::text;");
    // 0015's own rules are kept.
    expect(check).toContain("if old.archived_at is not null and new.archived_at is not null then");
    expect(check).toContain("hint = 'PATIENT_BIRTH_DATE_INVALID'");
  });
});

describe("0017 the appointments on a closure's days (D87, D137)", () => {
  it("is settings.manage's, names a patient only to someone who may see them, and counts them all", () => {
    const listed = functionBody(sql, "closure_appointments");
    expect(listed).toContain("not public.has_permission('settings.manage')");
    expect(listed).toContain(
      "when names_seen and (every_patient or appointment.patient_id in (select public.doctor_patient_ids()))",
    );
    expect(listed).toContain("names_seen boolean := public.has_permission('appointments.view');");
    expect(listed).toContain("count(*) over ()");
    expect(listed).toContain("and appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')");
    expect(listed).toContain("limit p_limit;");
  });
});

describe("0017 indexes (plan §37.1)", () => {
  it("serves every read with an index that leads with the clinic, in its own order", () => {
    expect(sql).toContain(
      "create index appointments_clinic_id_local_date_idx on public.appointments (clinic_id, local_date, scheduled_at);",
    );
    expect(sql).toContain(
      "create index appointments_clinic_id_doctor_id_idx on public.appointments (clinic_id, doctor_id, local_date, scheduled_at);",
    );
    expect(sql).toContain(
      "create index appointments_clinic_id_patient_id_idx on public.appointments (clinic_id, patient_id, scheduled_at desc);",
    );
  });

  it("indexes every foreign key", () => {
    expect(sql).toContain(
      "create index appointments_appointment_type_id_idx on public.appointments (appointment_type_id);",
    );
    expect(sql).toContain("create index appointments_created_by_idx on public.appointments (created_by);");
    expect(sql).toContain("create index appointments_updated_by_idx on public.appointments (updated_by);");
    expect(sql).toContain(
      "create index appointments_cancelled_by_idx on public.appointments (cancelled_by) where cancelled_by is not null;",
    );
    expect(sql).toContain("create index daily_tokens_clinic_id_idx on public.daily_tokens (clinic_id);");
  });
});

describe("0017 policies and grants (plan §27.4)", () => {
  it("is read with appointments.view, a doctor only their own patients', worked out once a statement", () => {
    const select = policy("appointments_select");
    expect(select).toContain("clinic_id = (select public.current_clinic_id())");
    expect(select).toContain("(select public.has_permission('appointments.view'))");
    expect(select).toContain(
      "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
    );
    expect(select).not.toContain("can_see_patient");
  });

  it("is written only through its functions; the token counter is the database's alone", () => {
    expect(sql).toContain("grant select on public.appointments to authenticated;");
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.appointments/);
    expect(sql).not.toMatch(/grant [^;]* on public\.daily_tokens/);
    expect(sql).toContain("alter table public.daily_tokens enable row level security;");
    for (const name of [
      "create_appointment(jsonb, uuid)",
      "update_appointment(uuid, jsonb)",
      "add_walk_in(jsonb, uuid)",
    ]) {
      expect(sql).toContain(`grant execute on function public.${name} to authenticated;`);
    }
    for (const name of [
      "next_token(uuid, uuid, date)",
      "check_booking(uuid, uuid, uuid, uuid, timestamptz, boolean)",
      "raise_slot_taken(uuid, timestamptz, integer, uuid)",
      "appointment_for_change(uuid, text)",
      "appointment_slot(timestamptz, integer)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon, authenticated;`);
    }
  });

  it("refuses with the app's own codes", () => {
    const codes = new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]));
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
    expect(codes).toContain("APPOINTMENT_NOT_MOVABLE");
    expect(codes).toContain("APPOINTMENT_NOT_TODAY");
    expect(codes).toContain("APPOINTMENT_IN_PAST");
    expect(codes).toContain("APPOINTMENT_TYPE_INACTIVE");
  });
});
