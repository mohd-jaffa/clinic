import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { BILL_PAYMENT_STATES, PAYMENT_KINDS, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/constants/statuses";
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

const sql = readMigration("0029_payments.sql");
const bills = readMigration("0028_bills.sql");
const payments = tableBody(sql, "payments");
const balances = tableBody(sql, "patient_balances");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

/** Every refusal a function raises is one of the app's own codes. */
function refusesInOwnWords(body: string) {
  for (const hint of quoted(body.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
    expect(isErrorMessageCode(hint), hint).toBe(true);
  }
}

describe("0029 a payment (plan §15.3, §28.6)", () => {
  it("hangs from the clinic and names its own patient, never a bill (D4)", () => {
    expect(payments).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(payments).toContain("unique (id, clinic_id)");
    expect(payments).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id)");
    expect(payments).not.toContain("bill_id");
  });

  it("holds the kinds, methods and statuses the app knows, its amount within MAX_AMOUNT_PAISE and never nothing", () => {
    expect(checkedValues(payments, "kind")).toEqual([...PAYMENT_KINDS]);
    expect(columnLine(sql, "payments", "kind")).toContain("default 'PAYMENT'");
    expect(checkedValues(payments, "method")).toEqual([...PAYMENT_METHODS]);
    expect(checkedValues(payments, "status")).toEqual([...PAYMENT_STATUSES]);
    expect(columnLine(sql, "payments", "status")).toContain("default 'RECORDED'");
    expect(betweenBounds(sql, "payments", "amount_paise")).toEqual({ min: 1, max: MAX_AMOUNT_PAISE });
  });

  it("bounds its text as the screen does, and is void when it was, with its reason", () => {
    expect(cleanTextLimit(sql, "payments", "reference")).toBe(TEXT_LIMITS.reference);
    expect(cleanTextLimit(sql, "payments", "note")).toBe(TEXT_LIMITS.paymentNote);
    expect(cleanTextLimit(sql, "payments", "void_reason")).toBe(TEXT_LIMITS.reason);
    expect(payments).toContain(
      "(status = 'VOID') = (voided_at is not null) and (status = 'VOID') = (void_reason is not null)",
    );
  });

  it("keeps when it was paid and that day, who received and voided it, and its idempotency key", () => {
    expect(columnLine(sql, "payments", "paid_at")).toContain("timestamptz not null default now()");
    expect(columnLine(sql, "payments", "paid_on")).toContain("date not null");
    for (const actor of ["received_by", "voided_by"]) {
      expect(columnLine(sql, "payments", actor)).toContain("references public.profiles (id) on delete set null");
    }
    expect(payments).toContain("unique (clinic_id, idempotency_key)");
  });

  it("is never edited: it only goes void, once, stamped with when and by whom", () => {
    const check = functionBody(sql, "check_payment");
    expect(check).toContain("if old.status = 'VOID' or new.status <> 'VOID'");
    expect(check).toContain("new.voided_at := now();\n  new.voided_by := auth.uid();");
    expect(sql).toContain("create trigger check_payment before update on public.payments");
    refusesInOwnWords(check);
  });
});

describe("0029 balances (plan §15.4, D295)", () => {
  it("keep each patient's billed, paid and refunded, the balance worked out from them", () => {
    expect(balances).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(balances).toContain("patient_id uuid primary key");
    expect(balances).toContain("foreign key (patient_id, clinic_id) references public.patients (id, clinic_id)");
    for (const column of ["billed_paise", "paid_paise", "refunded_paise"]) {
      expect(columnLine(sql, "patient_balances", column)).toContain(`bigint not null default 0 check (${column} >= 0)`);
    }
    expect(columnLine(sql, "patient_balances", "balance_paise")).toContain(
      "generated always as (billed_paise - paid_paise + refunded_paise) stored",
    );
    expect(balances).toContain("constraint patient_balances_refunds check (refunded_paise <= paid_paise)");
  });

  it("are changed only by add_to_balance, which never inserts a negative row", () => {
    const add = functionBody(sql, "add_to_balance");
    expect(add).toContain("on conflict (patient_id) do nothing;");
    expect(add).toContain("set billed_paise = balance.billed_paise + p_billed");
    expect(sql).toContain(
      "revoke all on function public.add_to_balance(uuid, uuid, bigint, bigint, bigint) from public, anon, authenticated;",
    );
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.patient_balances/);
  });

  it("start from the bills issued before payments came", () => {
    expect(sql).toContain(
      "insert into public.patient_balances (clinic_id, patient_id, billed_paise)\nselect bill.clinic_id, bill.patient_id, sum(bill.total_paise)",
    );
  });
});

describe("0029 each bill's paid and due (plan §15.2, D298)", () => {
  const view = /create view public\.bill_settlement[\s\S]*?;\n/.exec(sql)![0];

  it("settles a patient's issued bills oldest first with their net payments, read as the caller", () => {
    expect(view).toContain("with (security_invoker = true)");
    expect(view).toContain("partition by issued.patient_id order by issued.issued_at, issued.id");
    expect(view).toContain("where issued.status = 'ISSUED'");
    expect(view).toContain("greatest(0, coalesce(balance.paid_paise - balance.refunded_paise, 0) - bill.before_paise)");
  });

  it("names the states the app knows", () => {
    expect(quoted(/case[\s\S]*?end as state/.exec(view)![0])).toEqual([...BILL_PAYMENT_STATES]);
  });
});

describe("0029 recording and voiding (plan §15.3; D297, D299, D301)", () => {
  const record = functionBody(sql, "record_payment");
  const voiding = functionBody(sql, "void_payment");

  it("records a payment with payments.create, a refund with payments.edit, once per key, while the clinic writes", () => {
    expect(record).toContain(
      "not public.has_permission(case when given.kind = 'REFUND' then 'payments.edit' else 'payments.create' end)",
    );
    expect(record).toContain("hint = 'IDEMPOTENCY_KEY_REQUIRED'");
    expect(record).toContain("perform public.require_clinic_write(clinic);");
    expect(record).toContain(
      "perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));",
    );
    expect(record).toContain("if found_patient.id is null or not public.can_see_patient(found_patient.id) then");
    expect(record).toContain("hint = 'PATIENT_ARCHIVED'");
    refusesInOwnWords(record);
  });

  it("is paid now or before, on the clinic's day, received by the caller (D299)", () => {
    expect(record).toContain("given.paid_at := coalesce(given.paid_at, now());");
    expect(record).toContain("if given.paid_at > now() then");
    expect(record).toContain("(given.paid_at at time zone place.timezone)::date");
    expect(record).toContain("auth.uid(), p_idempotency_key");
  });

  it("refunds no more than the advance held, with the balance held (D297)", () => {
    expect(record).toContain("for update;");
    expect(record).toContain(
      "if coalesce(held.paid_paise - held.refunded_paise - held.billed_paise, 0) < given.amount_paise then",
    );
    expect(record).toContain("hint = 'PAYMENT_REFUND_TOO_LARGE'");
  });

  it("voids with payments.edit and a reason, a payment only once no refund stands on it (D301)", () => {
    expect(voiding).toContain("if clinic is null or not public.has_permission('payments.edit') then");
    expect(voiding).toContain("perform public.require_clinic_write(clinic);");
    expect(voiding).toContain("if found.status = 'VOID' then");
    expect(voiding).toContain("hint = 'PATIENT_ARCHIVED'");
    expect(voiding).toContain(
      "if found.kind = 'PAYMENT' and held.paid_paise - found.amount_paise < held.refunded_paise then",
    );
    expect(voiding).toContain("hint = 'PAYMENT_HAS_REFUNDS'");
    refusesInOwnWords(voiding);
  });

  it("is called by members only", () => {
    for (const signature of ["record_payment(jsonb, uuid)", "void_payment(uuid, text)"]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
    expect(sql).toContain("revoke all on function public.check_payment() from public, anon, authenticated;");
  });
});

describe("0029 a bill with what is collected (D282)", () => {
  const create = functionBody(sql, "create_bill");

  it("is 0028's bill — every rule kept — and is now the one the database runs", () => {
    expect(latestFunctionBody("create_bill")).toBe(create);
    expect(latestFunctionBody("void_bill")).toBe(functionBody(sql, "void_bill"));
    const before = functionBody(bills, "create_bill");
    for (const rule of [
      "if clinic is null or not public.has_permission('payments.create') then",
      "if found_appointment.status not in ('ARRIVED', 'IN_PROGRESS') then",
      "and not (service.category = 'CONSULTATION' and fee is not null and line.unit_price_paise = fee) then",
      "elsif not discounts then",
      "if given.discount_paise <> 0 and not discounts then",
      "or given.total_paise is distinct from subtotal - given.discount_paise then",
      "public.next_bill_number(clinic, year)",
      "set billing_status = 'BILLED', no_charge_reason = null, no_charge_note = null",
    ]) {
      expect(before, rule).toContain(rule);
      expect(create, rule).toContain(rule);
    }
    refusesInOwnWords(create);
  });

  it("records the payment with it, paid now under the bill's key, and keeps the balance", () => {
    expect(create).toContain("if jsonb_typeof(p_bill -> 'payment') = 'object' then");
    expect(create).toContain("clinic, found_patient.id, 'PAYMENT', paying.amount_paise, paying.method");
    expect(create).toContain("now(), today,\n      auth.uid(), p_idempotency_key");
    expect(create).toContain(
      "balance_after := public.add_to_balance(clinic, found_patient.id, made.total_paise, coalesce(paid.amount_paise, 0), 0);",
    );
    // Issued again by its key, the payment it was issued with.
    expect(create).toContain("where payment.clinic_id = clinic and payment.idempotency_key = p_idempotency_key;");
  });

  it("takes a voided bill off the balance", () => {
    expect(functionBody(sql, "void_bill")).toContain(
      "balance_after := public.add_to_balance(clinic, found.patient_id, -found.total_paise, 0, 0);",
    );
  });
});

describe("0029 indexes (plan §37.1)", () => {
  it("lead with the clinic for the payments, a patient's, and those who owe, and cover each foreign key", () => {
    for (const index of [
      "create index payments_clinic_id_paid_at_idx on public.payments (clinic_id, paid_at desc);",
      "create index payments_clinic_id_patient_id_idx on public.payments (clinic_id, patient_id, paid_at desc);",
      "create index payments_received_by_idx on public.payments (received_by);",
      "create index payments_voided_by_idx on public.payments (voided_by) where voided_by is not null;",
      "create index patient_balances_clinic_id_owing_idx\n  on public.patient_balances (clinic_id, balance_paise desc) where balance_paise > 0;",
    ]) {
      expect(sql).toContain(index);
    }
  });
});

describe("0029 policies (plan §27.4)", () => {
  it("reads payments and balances with payments.view, in the doctor scope", () => {
    for (const table of ["payments", "patient_balances"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
      const read = policy(`${table}_select`);
      expect(read, table).toContain("clinic_id = (select public.current_clinic_id())");
      expect(read, table).toContain("(select public.has_permission('payments.view'))");
      expect(read, table).toContain(
        "((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))",
      );
    }
  });

  it("writes nothing but through its functions", () => {
    expect(sql).not.toMatch(/create policy \w+ on public\.(payments|patient_balances)\s+for (insert|update|delete)/);
    expect(sql).toContain(
      "grant select on public.payments, public.patient_balances, public.bill_settlement to authenticated;",
    );
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]* on public\.(payments|patient_balances)/);
  });
});
