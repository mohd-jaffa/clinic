import { describe, expect, it } from "vitest";

import { CLINIC_ROLES } from "@/constants/roles";
import { APPOINTMENT_STATUSES, FOLLOW_UP_TABS, MEMBER_STATUSES, PAYMENT_KINDS } from "@/constants/statuses";
import { functionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0034_dashboard_and_reports.sql");
const money = functionBody(sql, "money_by_day");
const visits = functionBody(sql, "visits_done");
const appointments = functionBody(sql, "appointment_counts");
const outstanding = functionBody(sql, "clinic_outstanding");
const home = functionBody(sql, "dashboard_summary");
const daily = functionBody(sql, "report_daily");
const monthly = functionBody(sql, "report_monthly");

const DEFINITIONS = [
  "clinic_day_start(uuid, date)",
  "money_by_day(uuid, date, date)",
  "visits_done(uuid, date, date, uuid[])",
  "appointment_counts(uuid, date, date, uuid[])",
  "clinic_outstanding(uuid)",
];
const READS = ["dashboard_summary(integer, integer)", "report_daily(date)", "report_monthly(date)"];

describe("0034 Home and reports (plan §17, §18, §28.7; D49, D53, D345 – D349)", () => {
  it("indexes the visits done by day, every doctor's", () => {
    expect(sql).toContain(
      "create index visits_clinic_id_completed_idx on public.visits (clinic_id, visit_date)\n  where status = 'COMPLETED';",
    );
  });

  it("defines each figure once, readable by the functions below and by no member", () => {
    for (const definition of DEFINITIONS) {
      expect(sql).toContain(`revoke all on function public.${definition} from public, anon, authenticated;`);
      expect(sql).not.toContain(`grant execute on function public.${definition}`);
      expect(functionBody(sql, definition.split("(")[0])).not.toContain("security definer");
    }
  });

  it("collects payments less refunds, bills and spends by the clinic's day, leaving voids and archives out (D345)", () => {
    expect(money).toContain(
      "sum(case when payment.kind = 'REFUND' then -payment.amount_paise else payment.amount_paise end)",
    );
    expect(money).toContain("and payment.status = 'RECORDED'");
    expect(money).toContain("and bill.status = 'ISSUED'");
    expect(money).toContain("and expense.archived_at is null");
    expect(money).toContain("public.clinic_day_start(p_clinic_id, p_to + 1) as ends");
    expect(money).toContain("(coalesce(collected.paise, 0) - coalesce(spent.paise, 0))::bigint");
    expect(money).toContain("generate_series(0, p_to - p_from)");
  });

  it("counts the patients seen once each, the appointments without the cancelled (D346), and only what is owed", () => {
    expect(visits).toContain("count(distinct visit.patient_id), count(*)");
    expect(visits).toContain("and visit.status = 'COMPLETED'");
    expect(visits).toContain("(p_doctors is null or visit.doctor_id = any (p_doctors))");
    expect(appointments).toContain("sum(counted.total) filter (where counted.status <> 'CANCELLED')");
    expect(appointments).toContain("jsonb_object_agg(counted.status, counted.total)");
    expect(outstanding).toContain("balance.balance_paise > 0");
  });

  it("names only the app's own statuses, tabs and roles", () => {
    const listed = (pattern: RegExp) => quoted(pattern.exec(sql)![1]);
    for (const status of [...listed(/appointment\.status in \(([^)]+)\)/), ...["CANCELLED", "COMPLETED"]]) {
      expect(APPOINTMENT_STATUSES, status).toContain(status);
    }
    for (const tab of listed(/row\.tab in \(([^)]+)\)/)) expect(FOLLOW_UP_TABS, tab).toContain(tab);
    for (const status of listed(/member\.status in \(([^)]+)\)/)) expect(MEMBER_STATUSES, status).toContain(status);
    expect(CLINIC_ROLES).toContain("OWNER");
    expect(PAYMENT_KINDS).toContain("REFUND");
  });

  it("reads Home as the clinic's member, each section with its permission, a doctor's own day (D347)", () => {
    expect(home).toContain("security definer");
    expect(home).toContain("raise exception 'Home is a clinic member''s' using hint = 'AUTH_PERMISSION_DENIED';");
    expect(home).toContain("doctors := case when sees_all then null else array[public.current_doctor_id()] end;");
    expect(home).toContain("sees_appointments boolean := public.has_permission('appointments.view');");
    expect(home).toContain("sees_payments boolean := public.has_permission('payments.view');");
    expect(home).toContain("'money', case when public.has_permission('reports.view') then (");
    expect(home).toContain("'follow_ups', case when public.works_follow_ups() then (");
    expect(home).toContain("'expenses', case when public.has_permission('expenses.view') then (");
    expect(home).toContain("'to_bill', case when sees_payments then jsonb_build_object(");
    for (const section of ["'day'", "'queue'", "'upcoming'"]) {
      expect(home).toContain(`${section}, case when sees_appointments then (`);
    }
    for (const section of ["'owing'", "'payments'"]) {
      expect(home).toContain(`${section}, case when sees_payments then (`);
    }
  });

  it("keeps Home's patients to the doctor's own, and its lists to their limits (D349)", () => {
    expect(home).toContain("(sees_all or balance.patient_id in (select public.doctor_patient_ids()))");
    expect(home).toContain("(sees_all or payment.patient_id in (select public.doctor_patient_ids()))");
    expect(home.match(/\(doctors is null or appointment\.doctor_id = any \(doctors\)\)/g)).toHaveLength(2);
    expect(home).toContain("public.to_bill_visits(null, 0, lists)");
    expect(home).toContain("filter (where due.tab = 'TODAY' and due.place <= lists)");
    expect(home).toContain("limit queued");
    expect(home).toContain("order by waiting.token_number nulls last, waiting.arrived_at");
  });

  it("shows the getting-started steps until the first patient: a price above nothing, anyone else on the team (D348)", () => {
    expect(home).toContain("'getting_started', case when not exists (");
    expect(home).toContain("select 1 from public.patients as patient where patient.clinic_id = clinic");
    expect(home).toContain("service.active and service.price_paise > 0");
    expect(home).toContain("doctor.active and doctor.consultation_fee_paise > 0");
    expect(home).toContain("member.role <> 'OWNER' and member.status in ('INVITED', 'ACTIVE')");
  });

  it("reads the reports with reports.view, of today or this month or before", () => {
    for (const report of [daily, monthly]) {
      expect(report).toContain("security definer");
      expect(report).toContain(
        "if clinic is null or not public.has_permission('reports.view') then\n    raise exception 'Reports need reports.view' using hint = 'AUTH_PERMISSION_DENIED';",
      );
      expect(report).toContain("using hint = 'VALIDATION_ERROR';");
    }
    expect(daily).toContain("p_day > public.clinic_today(clinic)");
    expect(monthly).toContain("first_day > public.clinic_today(clinic)");
  });

  it("sums the day-end collections by who took the money and how, and the day's voids (D49)", () => {
    expect(daily).toContain("group by payment.received_by, payment.method");
    expect(daily).toContain("and payment.status = 'VOID'");
    expect(daily).toContain("from public.money_by_day(clinic, p_day, p_day) as money");
  });

  it("splits the month's patients into new and returning, and bills by doctor with what is paid to date (D53)", () => {
    expect(monthly).toContain("count(*) filter (where not seen.earlier) as new_patients");
    expect(monthly).toContain("and before.visit_date < first_day");
    expect(monthly).toContain("where settlement.patient_id = any (billed)");
    expect(monthly).toContain("full join issued on issued.doctor_id = seen.doctor_id");
    expect(monthly).toContain("order by line.doctor_id is null, profile.full_name, line.doctor_id");
  });

  it("lets every member call Home and the reports, and no one signed out", () => {
    for (const read of READS) {
      expect(sql).toContain(`revoke all on function public.${read} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${read} to authenticated;`);
    }
  });
});
