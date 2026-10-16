import { describe, expect, it } from "vitest";

import { BILL_MAX_ITEMS, MAX_AMOUNT_PAISE, MAX_QUANTITY, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { BILL_STATUSES, SERVICE_CATEGORIES } from "@/constants/statuses";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  latestFunctionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0028_bills.sql");
const bills = tableBody(sql, "bills");
const items = tableBody(sql, "bill_items");
const counters = tableBody(sql, "bill_counters");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

/** Every refusal a function raises is one of the app's own codes. */
function refusesInOwnWords(body: string) {
  for (const hint of quoted(body.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
    expect(isErrorMessageCode(hint), hint).toBe(true);
  }
}

describe("0028 a bill (plan §15.2, §28.6)", () => {
  it("hangs from the clinic and names its own patient, visit, arrival and doctor", () => {
    expect(bills).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(bills).toContain("unique (id, clinic_id)");
    for (const [column, table] of [
      ["patient_id", "patients"],
      ["visit_id", "visits"],
      ["appointment_id", "appointments"],
      ["doctor_id", "doctors"],
    ]) {
      expect(bills).toContain(`foreign key (${column}, clinic_id) references public.${table} (id, clinic_id)`);
    }
    expect(columnLine(sql, "bills", "patient_id")).toContain("uuid not null");
    // For a visit or for an arrival (D283), never both.
    expect(bills).toContain("constraint bills_for check (visit_id is null or appointment_id is null)");
  });

  it("is numbered once per clinic, in its financial year, and made once per idempotency key", () => {
    expect(bills).toContain("unique (clinic_id, bill_number)");
    expect(bills).toContain("unique (clinic_id, idempotency_key)");
    expect(columnLine(sql, "bills", "idempotency_key")).toContain("uuid not null");
    expect(columnLine(sql, "bills", "financial_year")).toContain("check (financial_year ~ '^[0-9]{4}-[0-9]{2}$')");
    expect(bills).toContain("constraint bills_number check (bill_number like financial_year || '/%')");
    expect(columnLine(sql, "bills", "issued_on")).toContain("date not null");
  });

  it("holds the statuses the app knows, its money within MAX_AMOUNT_PAISE, its total its subtotal less the discount", () => {
    expect(checkedValues(bills, "status")).toEqual([...BILL_STATUSES]);
    expect(columnLine(sql, "bills", "status")).toContain("default 'ISSUED'");
    for (const column of ["subtotal_paise", "discount_paise", "total_paise"]) {
      expect(betweenBounds(sql, "bills", column)).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
      expect(columnLine(sql, "bills", column)).toContain("integer not null");
    }
    expect(bills).toContain(
      "constraint bills_totals check (discount_paise <= subtotal_paise and total_paise = subtotal_paise - discount_paise)",
    );
  });

  it("bounds its text as the screen does, and is void when it was, with its reason", () => {
    expect(cleanTextLimit(sql, "bills", "notes")).toBe(TEXT_LIMITS.notes);
    expect(columnLine(sql, "bills", "notes")).toContain("is_clean_text");
    expect(cleanTextLimit(sql, "bills", "void_reason")).toBe(TEXT_LIMITS.reason);
    expect(bills).toContain(
      "(status = 'VOID') = (voided_at is not null) and (status = 'VOID') = (void_reason is not null)",
    );
  });

  it("keeps who issued and voided it after the audit purge", () => {
    for (const actor of ["created_by", "voided_by"]) {
      expect(columnLine(sql, "bills", actor)).toContain("references public.profiles (id) on delete set null");
    }
  });

  it("is never edited: it only goes void, once, stamped with when and by whom", () => {
    const check = functionBody(sql, "check_bill");
    expect(check).toContain("if old.status = 'VOID' or new.status <> 'VOID'");
    expect(check).toContain(
      "(to_jsonb(new) - array['status', 'void_reason', 'voided_by', 'voided_at'])\n        <> (to_jsonb(old) - array['status', 'void_reason', 'voided_by', 'voided_at'])",
    );
    expect(check).toContain("new.voided_at := now();\n  new.voided_by := auth.uid();");
    expect(sql).toContain("create trigger check_bill before update on public.bills");
    refusesInOwnWords(check);
  });
});

describe("0028 a bill's lines (plan §28.6; D284, D285)", () => {
  it("are the bill's own, in order, at most BILL_MAX_ITEMS, each its quantity times its price", () => {
    expect(items).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(items).toContain(
      "foreign key (bill_id, clinic_id) references public.bills (id, clinic_id) on delete cascade",
    );
    expect(items).toContain("unique (bill_id, position)");
    expect(betweenBounds(sql, "bill_items", "position")).toEqual({ min: 1, max: BILL_MAX_ITEMS });
    expect(betweenBounds(sql, "bill_items", "quantity")).toEqual({ min: 1, max: MAX_QUANTITY });
    expect(betweenBounds(sql, "bill_items", "unit_price_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
    expect(betweenBounds(sql, "bill_items", "amount_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
    expect(items).toContain(
      "constraint bill_items_amount check (amount_paise::bigint = quantity::bigint * unit_price_paise)",
    );
  });

  it("name the price-list entry they came from, its name kept as long as the price list's, and a treatment only through one", () => {
    expect(sql).toContain(
      "alter table public.services add constraint services_id_clinic_unique unique (id, clinic_id);",
    );
    expect(items).toContain("foreign key (service_id, clinic_id) references public.services (id, clinic_id)");
    expect(items).toContain("foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id)");
    expect(cleanTextLimit(sql, "bill_items", "description")).toBe(TEXT_LIMITS.serviceName);
    expect(columnLine(sql, "bill_items", "description")).toContain("text not null");
    expect(items).toContain("constraint bill_items_treatment check (treatment_id is null or service_id is not null)");
  });
});

describe("0028 bill numbers (D27)", () => {
  it("count per clinic and financial year, from 0005's financial_year(), never max() + 1", () => {
    expect(counters).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(counters).toContain("primary key (clinic_id, financial_year)");
    expect(counters).toContain("last_number integer not null check (last_number >= 1)");
    const next = functionBody(sql, "next_bill_number");
    expect(next).toContain(
      "on conflict (clinic_id, financial_year) do update set last_number = counter.last_number + 1",
    );
    // Four digits at least, never cut short past 9999.
    expect(next).toContain("lpad(counter.last_number::text, greatest(4, length(counter.last_number::text)), '0')");
    expect(sql).not.toContain("create or replace function public.financial_year(");
    const create = functionBody(sql, "create_bill");
    expect(create).toContain("year := public.financial_year(today);");
    expect(create).toContain("public.next_bill_number(clinic, year)");
    expect(create).not.toMatch(/max\(/);
  });
});

describe("0028 issuing a bill (plan §15.2; D29, D283 – D289)", () => {
  const create = functionBody(sql, "create_bill");

  it("needs payments.create, its idempotency key, a clinic that writes, and a patient seen and not archived", () => {
    expect(create).toContain("if clinic is null or not public.has_permission('payments.create') then");
    expect(create).toContain("hint = 'IDEMPOTENCY_KEY_REQUIRED'");
    expect(create).toContain("perform public.require_clinic_write(clinic);");
    expect(create).toContain(
      "perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));",
    );
    expect(create).toContain("if found_patient.id is null or not public.can_see_patient(found_patient.id) then");
    expect(create).toContain("hint = 'PATIENT_ARCHIVED'");
    refusesInOwnWords(create);
  });

  it("bills a visit of the patient's, or their appointment while they are here, holding it until issued (D283)", () => {
    expect(create).toContain("found_visit.patient_id <> found_patient.id");
    expect(create).toContain("found_appointment.patient_id <> found_patient.id");
    expect(create).toContain("if found_appointment.status not in ('ARRIVED', 'IN_PROGRESS') then");
    expect(create.match(/ for update;/g)).toHaveLength(2);
  });

  it("holds each price to the list — a Consultation line to the doctor's fee too — without payments.discount (D29, D289)", () => {
    expect(create).toContain("discounts boolean := public.has_permission('payments.discount');");
    expect(create).toContain("entry.id = line.service_id and entry.clinic_id = clinic and entry.active");
    expect(create).toContain("line.description := service.name;");
    expect(create).toContain(
      "if not discounts and line.unit_price_paise <> service.price_paise\n         and not (service.category = 'CONSULTATION' and fee is not null and line.unit_price_paise = fee) then",
    );
    expect(SERVICE_CATEGORIES).toContain("CONSULTATION");
    // A typed line, and a discount, need it too (D284).
    expect(create).toContain("elsif not discounts then\n      raise exception 'A typed line needs payments.discount'");
    expect(create).toContain("if given.discount_paise <> 0 and not discounts then");
    expect(create.match(/hint = 'BILL_PRICE_NOT_ALLOWED'/g)).toHaveLength(3);
  });

  it("keeps a bill within BILL_MAX_ITEMS lines and MAX_AMOUNT_PAISE, and its totals as the screen worked them out", () => {
    expect(create).toContain(`not between 1 and ${BILL_MAX_ITEMS} then`);
    expect(create).toContain(`line.quantity not between 1 and ${MAX_QUANTITY}`);
    expect(create).toContain(`line.quantity::bigint * line.unit_price_paise > ${MAX_AMOUNT_PAISE}`);
    expect(create).toContain(`if subtotal > ${MAX_AMOUNT_PAISE} or given.discount_paise not between 0 and subtotal`);
    expect(create).toContain("or given.subtotal_paise is distinct from subtotal");
    expect(create).toContain("or given.total_paise is distinct from subtotal - given.discount_paise then");
  });

  it("names only the patient's own treatment, and makes a done visit Billed from To bill or No charge (D285, D287)", () => {
    expect(create).toContain("and treatment.patient_id = found_patient.id");
    expect(create).toContain("if found_visit.status = 'COMPLETED' and found_visit.billing_status <> 'BILLED' then");
    expect(create).toContain("set billing_status = 'BILLED', no_charge_reason = null, no_charge_note = null");
  });

  it("is called by members only", () => {
    for (const signature of ["create_bill(jsonb, uuid)", "void_bill(uuid, text)", "mark_no_charge(uuid, text, text)"]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
    for (const signature of ["next_bill_number(uuid, text)", "visit_billed(public.visits)", "check_bill()"]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
    }
  });
});

describe("0028 when a visit is Billed (plan §15.6; D286)", () => {
  it("by an issued bill of its own, or its arrival's with no treatment worked on in it", () => {
    const billed = functionBody(sql, "visit_billed");
    expect(billed).toContain("bill.visit_id = p_visit.id and bill.status = 'ISSUED'");
    expect(billed).toContain("and bill.appointment_id = p_visit.appointment_id");
    expect(billed).toContain("session.clinic_id = p_visit.clinic_id and session.visit_id = p_visit.id");
  });

  it("closes so from the queue and from the profile, read in a statement of its own, and says which", () => {
    for (const name of ["finish_appointment", "finish_visit"]) {
      const finish = latestFunctionBody(name);
      expect(finish, name).toBe(functionBody(sql, name));
      expect(finish, name).toContain("billing_status = 'TO_BILL'");
      expect(finish, name).toMatch(
        /set billing_status = 'BILLED'\s+where visit\.id = \w+(\.id)? and public\.visit_billed\(visit\)\s+returning visit\.billing_status into \w+;/,
      );
    }
    // The closed visit's billing state goes to the audit row (plan §27.6).
    expect(functionBody(sql, "finish_appointment")).toContain("'billing', coalesce(billing, 'TO_BILL')");
    expect(sql).toContain("drop function public.finish_visit(uuid);");
    expect(functionBody(sql, "finish_visit")).toContain("returns table (previously text, billing text)");
    expect(sql).toContain("grant execute on function public.finish_visit(uuid) to authenticated;");
  });

  it("goes back to To bill when a void leaves nothing billed (payments.edit, a reason)", () => {
    const voiding = functionBody(sql, "void_bill");
    expect(voiding).toContain("if clinic is null or not public.has_permission('payments.edit') then");
    expect(voiding).toContain("perform public.require_clinic_write(clinic);");
    expect(voiding).toContain("not public.can_see_patient(found.patient_id)");
    expect(voiding).toContain("if found.status = 'VOID' then");
    expect(voiding).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(voiding).toContain("(visit.id = found.visit_id or visit.appointment_id = found.appointment_id)");
    expect(voiding).toContain("if billed.id is not null and not public.visit_billed(billed) then");
    refusesInOwnWords(voiding);
  });

  it("is No charge only from To bill (payments.create), twice changing nothing", () => {
    const free = functionBody(sql, "mark_no_charge");
    expect(free).toContain("if clinic is null or not public.has_permission('payments.create') then");
    expect(free).toContain("perform public.require_clinic_write(clinic);");
    expect(free).toContain("if found.billing_status = 'NO_CHARGE' then");
    expect(free).toContain("if found.billing_status is distinct from 'TO_BILL' then");
    expect(free).toContain("hint = 'VISIT_NOT_TO_BILL'");
    expect(free).toContain("set billing_status = 'NO_CHARGE', no_charge_reason = p_reason, no_charge_note = p_note");
    refusesInOwnWords(free);
  });
});

describe("0028 Back to waiting (D197)", () => {
  it("keeps a visit a bill names, as one with anything recorded", () => {
    const empty = latestFunctionBody("visit_is_empty");
    expect(empty).toBe(functionBody(sql, "visit_is_empty"));
    expect(empty).toContain("select not public.visit_recorded(visit)");
    expect(empty).toContain("bill.clinic_id = visit.clinic_id and bill.visit_id = visit.id");
    expect(empty).toContain("security definer");
  });
});

describe("0028 archiving a patient with a visit to bill (D288)", () => {
  const check = functionBody(sql, "check_patient");

  it("is refused while one waits, naming its day, after 0017's and 0024's refusals", () => {
    expect(latestFunctionBody("check_patient")).toBe(check);
    expect(check).toContain("and visit.billing_status = 'TO_BILL'");
    expect(check).toContain("hint = 'PATIENT_HAS_VISITS_TO_BILL'");
    expect(check).toContain("detail = json_build_object('visitDate', to_bill)::text;");
    expect(check.indexOf("PATIENT_HAS_TREATMENTS")).toBeLessThan(check.indexOf("PATIENT_HAS_VISITS_TO_BILL"));
    expect(check.indexOf("PATIENT_HAS_APPOINTMENTS")).toBeLessThan(check.indexOf("PATIENT_HAS_TREATMENTS"));
    refusesInOwnWords(check);
  });
});

describe("0028 indexes (plan §37.1)", () => {
  it("lead with the clinic for the bills, a patient's, a visit's, an arrival's and a doctor's, and cover each foreign key", () => {
    for (const index of [
      "create index bills_clinic_id_issued_at_idx on public.bills (clinic_id, issued_at desc);",
      "create index bills_clinic_id_patient_id_idx on public.bills (clinic_id, patient_id, issued_at);",
      "create index bills_clinic_id_visit_id_idx on public.bills (clinic_id, visit_id) where visit_id is not null;",
      "create index bills_clinic_id_appointment_id_idx\n  on public.bills (clinic_id, appointment_id) where appointment_id is not null;",
      "create index bills_clinic_id_doctor_id_idx on public.bills (clinic_id, doctor_id, issued_at);",
      "create index bills_created_by_idx on public.bills (created_by);",
      "create index bills_voided_by_idx on public.bills (voided_by) where voided_by is not null;",
      "create index bill_items_clinic_id_service_id_idx on public.bill_items (clinic_id, service_id) where service_id is not null;",
      "create index bill_items_clinic_id_treatment_id_idx\n  on public.bill_items (clinic_id, treatment_id) where treatment_id is not null;",
    ]) {
      expect(sql).toContain(index);
    }
  });
});

describe("0028 policies (plan §27.4)", () => {
  it("reads bills with payments.view in the doctor scope, and lines with their bill", () => {
    for (const table of ["bill_counters", "bills", "bill_items"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    const read = policy("bills_select");
    expect(read).toContain("clinic_id = (select public.current_clinic_id())");
    expect(read).toContain("(select public.has_permission('payments.view'))");
    expect(read).toContain(
      "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
    );
    expect(read).not.toContain("can_see_patient");
    expect(policy("bill_items_select")).toContain(
      "exists (select 1 from public.bills as bill where bill.id = bill_id)",
    );
  });

  it("writes nothing but through its functions; the counters are theirs alone", () => {
    expect(sql).not.toMatch(/create policy \w+ on public\.bill\w*\s+for (insert|update|delete)/);
    expect(sql).toContain("grant select on public.bills, public.bill_items to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]* on public\.bill/);
    expect(sql).not.toMatch(/grant [^;]* on public\.bill_counters/);
  });
});
