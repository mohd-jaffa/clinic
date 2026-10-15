// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";

import {
  countFollowUps,
  isOpen,
  listFollowUps,
  listPatientTreatments,
  toFollowUp,
  toTreatment,
  TREATMENT_COLUMNS,
} from "@/features/treatments/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";
import { aFollowUp, aFollowUpRow, aTreatment, aTreatmentRow } from "@tests/support/treatments";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  return { ...fake, tenant: { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant };
}

describe("toTreatment (plan §14.1, D261)", () => {
  it("reads a treatment, its doctor and its sessions in the order they were recorded", () => {
    const later = {
      id: "s-2",
      visit_id: "v-1",
      note: null,
      created_at: "2026-10-19T05:00:00+00:00",
      visit: { visit_date: "2026-10-19", doctor: null },
    };
    expect(toTreatment(aTreatmentRow({ sessions: [later, ...aTreatmentRow().sessions] }))).toEqual(
      aTreatment({
        sessions: [
          ...aTreatment().sessions,
          { id: "s-2", visitId: "v-1", day: "2026-10-19", doctorName: null, note: null },
        ],
      }),
    );
  });

  it("names no doctor once they are gone, takes a session's day from when it was made without its visit, and the day it was cancelled", () => {
    const read = toTreatment(
      aTreatmentRow({
        doctor: null,
        status: "CANCELLED",
        cancel_reason: "Declined",
        cancelled_at: "2026-10-13T20:00:00+00:00",
        sessions: [{ id: "s-1", visit_id: "v-0", note: null, created_at: "2026-10-12T05:00:00+00:00", visit: null }],
      }),
    );
    expect(read).toMatchObject({ doctorName: null, cancelReason: "Declined", cancelledOn: "2026-10-14" });
    expect(read.sessions[0]).toMatchObject({ day: "2026-10-12", doctorName: null });
  });
});

describe("isOpen", () => {
  it("is planned, in progress or on hold", () => {
    expect(["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => isOpen(s as never))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("listPatientTreatments (D260)", () => {
  it("reads a patient's treatments in one query, oldest first", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [aTreatmentRow()] }) });
    expect(await listPatientTreatments(tenant, "p-1")).toEqual([aTreatment()]);
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], "select")[0]).toEqual([TREATMENT_COLUMNS]);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["patient_id", "p-1"],
    ]);
    expect(argsOf(queries[0], "order")).toEqual([["created_at", { ascending: true }]]);
    expect(TREATMENT_COLUMNS).toContain("sessions:treatment_sessions!treatment_sessions_treatment_id_clinic_id_fkey(");
  });

  it("passes a failure on", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(listPatientTreatments(tenant, "p-1")).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});

describe("toFollowUp (plan §14.3, D275)", () => {
  it("reads a treatment's next sitting, not yet contacted", () => {
    expect(toFollowUp(aFollowUpRow())).toEqual(aFollowUp());
  });

  it("reads a visit's follow-up by its visit, and its last contact with who made it", () => {
    const read = toFollowUp(
      aFollowUpRow({
        kind: "VISIT",
        treatment_id: null,
        visit_id: "v-1",
        title: null,
        last_outcome: "NO_ANSWER",
        last_contacted_at: "2026-10-14T05:00:00+00:00",
        last_note: "Line busy",
        last_contacted_by: "Priya Shah",
      }),
    );
    expect(read).toMatchObject({ kind: "VISIT", id: "v-1", title: null });
    expect(read.lastContact).toEqual({
      outcome: "NO_ANSWER",
      at: "2026-10-14T05:00:00+00:00",
      note: "Line busy",
      by: "Priya Shah",
    });
  });
});

describe("listFollowUps (plan §14.3; D267)", () => {
  it("reads a page of a tab through follow_up_items, one more than a page to know if another follows", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: [aFollowUpRow()] }) });
    expect(await listFollowUps(tenant, { tab: "TODAY", cursor: undefined })).toEqual({
      items: [aFollowUp()],
      nextCursor: null,
    });
    expect(rpcs).toEqual([{ name: "follow_up_items", args: { p_tab: "TODAY", p_offset: 0, p_limit: PAGE_SIZE + 1 } }]);
  });

  it("starts at its cursor, and gives the next page's", async () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => aFollowUpRow({ treatment_id: `t-${index}` }));
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: rows }) });
    const page = await listFollowUps(tenant, { tab: "OVERDUE", cursor: PAGE_SIZE });
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.nextCursor).toBe(String(2 * PAGE_SIZE));
    expect(rpcs[0].args).toEqual({ p_tab: "OVERDUE", p_offset: PAGE_SIZE, p_limit: PAGE_SIZE + 1 });
  });

  it("passes a refusal on", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(listFollowUps(tenant, { tab: "TODAY", cursor: undefined })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("countFollowUps (plan §14.3, D271)", () => {
  it("reads how many each tab holds in one call", async () => {
    const totals = [
      { tab: "TODAY", total: 2 },
      { tab: "OVERDUE", total: 0 },
      { tab: "UPCOMING", total: 5 },
      { tab: "LAPSED", total: 1 },
      { tab: "COMPLETED", total: 3 },
    ];
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: totals }) });
    expect(await countFollowUps(tenant)).toEqual({ TODAY: 2, OVERDUE: 0, UPCOMING: 5, LAPSED: 1, COMPLETED: 3 });
    expect(rpcs).toEqual([{ name: "follow_up_counts", args: undefined }]);
  });

  it("passes a failure on", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ error: postgrestError("XX000") }) });
    await expect(countFollowUps(tenant)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
