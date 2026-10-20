import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, latestFunctionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0031_checkout.sql");
const toBill = functionBody(sql, "to_bill_visits");
const count = functionBody(sql, "to_bill_count");
const bills = functionBody(sql, "list_bills");
const search = functionBody(sql, "search_patients");
const billingStatus = functionBody(sql, "billing_status");

describe("0031 checkout (plan §15.4, §15.6, §10.2; D318 – D325, D334 – D338)", () => {
  it("indexes the visits waiting in To bill, oldest first", () => {
    expect(sql).toContain(
      "create index visits_clinic_id_to_bill_idx on public.visits (clinic_id, completed_at, id)\n  where billing_status = 'TO_BILL';",
    );
  });

  it("lists To bill for whoever reads bills, reception included, within the doctor scope (D318)", () => {
    for (const body of [toBill, count]) {
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = ''");
      expect(body).toContain("stable");
      expect(body).toContain("public.has_permission('payments.view')");
      expect(body).toContain("visit.clinic_id = clinic");
      expect(body).toContain("visit.billing_status = 'TO_BILL'");
      expect(body).toContain("(p_doctor_id is null or visit.doctor_id = p_doctor_id)");
      expect(body).toContain(
        "((select public.sees_every_patient()) or visit.patient_id in (select public.doctor_patient_ids()))",
      );
    }
  });

  it("names the patient, doctor, token, the treatments worked on and a fee paid at arrival, oldest first, a page at a time", () => {
    expect(toBill).toContain("patient.archived_at is not null");
    expect(toBill).toContain("appointment.token_number");
    expect(toBill).toContain("session.clinic_id = clinic and session.visit_id = visit.id");
    expect(toBill).toContain("array_agg(treatment.name order by treatment.created_at, treatment.id)");
    expect(toBill).toContain("bill.appointment_id = visit.appointment_id");
    expect(toBill).toContain("service.category = 'CONSULTATION'");
    expect(toBill).toContain("order by visit.completed_at, visit.id\n  offset p_offset\n   limit p_limit;");
  });

  it("lists bills as the caller, in a range, newest first, each with where it stands, kept to a state when asked (D320)", () => {
    expect(bills).not.toContain("security definer");
    expect(bills).toContain("set search_path = ''");
    expect(bills).toContain("bill.issued_at >= p_from");
    expect(bills).toContain("bill.issued_at < p_to");
    // The settlement for the patients billed in the range only, named as a value.
    expect(bills).toContain("where settlement.patient_id = any (billed)");
    expect(bills).toContain("coalesce(settled.state, 'VOID')");
    expect(bills).toContain("(p_state is null or coalesce(settled.state, 'VOID') = p_state)");
    expect(bills).toContain("order by bill.issued_at desc, bill.id desc");
  });

  it("searches the patients who owe for the Owing tab, most owed first (D101)", () => {
    expect(sql).toContain("drop function public.search_patients(text, text, integer, boolean, integer, integer);");
    expect(search).not.toContain("security definer");
    expect(search).toContain("left join public.patient_balances as balance on balance.patient_id = patient.id");
    expect(search).toContain("and (not p_owing or balance.balance_paise > 0)");
    expect(search).toContain(
      "case when p_owing then balance.balance_paise end desc nulls last,\n     patient.patient_number desc",
    );
    expect(latestFunctionBody("search_patients")).toBe(search);
  });

  it("says where an arrival's visit stands with billing, for whoever reads bills or visits, within the scope (D318)", () => {
    expect(billingStatus).toContain("security definer");
    expect(billingStatus).toContain("visit.appointment_id = p_appointment.id");
    expect(billingStatus).toContain("p_appointment.clinic_id = (select public.current_clinic_id())");
    expect(billingStatus).toContain(
      "((select public.has_permission('payments.view')) or (select public.has_permission('visits.view')))",
    );
    expect(billingStatus).toContain(
      "((select public.sees_every_patient()) or p_appointment.patient_id in (select public.doctor_patient_ids()))",
    );
  });

  it("refuses in the app's own words", () => {
    for (const hint of quoted(sql.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
      expect(isErrorMessageCode(hint), hint).toBe(true);
    }
  });

  it("is called by members only", () => {
    for (const signature of [
      "to_bill_visits(uuid, integer, integer)",
      "to_bill_count(uuid)",
      "list_bills(timestamptz, timestamptz, text, integer, integer)",
      "search_patients(text, text, integer, boolean, boolean, integer, integer)",
      "billing_status(public.appointments)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });
});
