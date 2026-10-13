import { describe, expect, it } from "vitest";

import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0019_urgent.sql");
const marked = functionBody(sql, "mark_urgent");

describe("0019 an urgent patient (plan §11.4, D201)", () => {
  it("is a tag on the appointment, held only while waiting, in, or done", () => {
    expect(sql).toContain("alter table public.appointments add column urgent_at timestamptz;");
    expect(sql).toContain("check (urgent_at is null or status in ('ARRIVED', 'IN_PROGRESS', 'COMPLETED'))");
  });

  it("drops off an appointment that leaves the queue other than through the doctor, whatever moved it", () => {
    const cleared = functionBody(sql, "clear_urgent");
    expect(cleared).toContain("if new.status not in ('ARRIVED', 'IN_PROGRESS', 'COMPLETED') then");
    expect(cleared).toContain("new.urgent_at := null;");
    expect(sql).toContain(
      "create trigger clear_urgent before update of status on public.appointments\nfor each row execute function public.clear_urgent();",
    );
    expect(sql).toContain("revoke all on function public.clear_urgent() from public, anon, authenticated;");
  });

  it("is marked while waiting and taken off while waiting or in, under the queue lock, handing back when before", () => {
    expect(marked).toContain("was public.appointments := public.queue_appointment(p_appointment_id);");
    expect(marked).toMatch(
      /if p_urgent and was\.status <> 'ARRIVED' then\s+raise exception [^;]*'APPOINTMENT_STATUS_NOT_ALLOWED'/,
    );
    expect(marked).toMatch(
      /if not p_urgent and was\.status not in \('ARRIVED', 'IN_PROGRESS'\) then\s+raise exception [^;]*'APPOINTMENT_STATUS_NOT_ALLOWED'/,
    );
    expect(marked).toContain("stamped := case when p_urgent then coalesce(was.urgent_at, now()) end;");
    expect(marked).toContain("return query select stamped, was.urgent_at;");
    expect(sql).toContain("revoke all on function public.mark_urgent(uuid, boolean) from public, anon;");
    expect(sql).toContain("grant execute on function public.mark_urgent(uuid, boolean) to authenticated;");
  });

  it("adds no read, so no index: the queue, the detail and the visit read the column with their row", () => {
    expect(sql).not.toContain("create index");
    expect(sql).not.toContain("create policy");
  });
});
