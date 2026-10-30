// @vitest-environment node
import { describe, expect, it } from "vitest";

import { listActivity, type ActivityRow } from "@/features/activity/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError } from "@tests/support/supabase";

const tenantWith = (client: unknown) => ({ supabase: client, clinicId: "clinic-1" }) as unknown as Tenant;

const row: ActivityRow = {
  id: "a-1",
  action: "CREATE",
  entity_type: "payments",
  entity_id: "pay-1",
  changes: { amount_paise: { from: null, to: 200_000 } },
  created_at: "2026-10-30T05:12:00.000Z",
  actor_name: "Anu Rao",
  patient: { id: "p-1", number: 1023, name: "Meena Iyer" },
  record: { kind: "PAYMENT", amount_paise: 200_000 },
  names: {},
};

describe("listActivity (plan §19; D388)", () => {
  it("asks for a page, one row more than a page, kept to a person and a kind's tables", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...row, id: `a-${index}` }));
    const { client, rpcs } = fakeSupabase({ rpc: () => ({ data: rows }) });
    const page = await listActivity(tenantWith(client), { person: "u-1", kind: "BILLING", cursor: 20 });
    expect(rpcs[0]).toEqual({
      name: "clinic_activity",
      args: { p_actor: "u-1", p_entity_types: ["bills", "payments"], p_offset: 20, p_limit: 21 },
    });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe("40");
    expect(page.items[0]).toEqual({
      id: "a-0",
      action: "CREATE",
      entityType: "payments",
      entityId: "pay-1",
      changes: { amount_paise: { from: null, to: 200_000 } },
      at: "2026-10-30T05:12:00.000Z",
      actorName: "Anu Rao",
      patient: { id: "p-1", number: 1023, name: "Meena Iyer" },
      record: { kind: "PAYMENT", amount_paise: 200_000 },
      names: {},
    });
  });

  it("asks for everyone's, of every kind, from the start; and says a refusal in the app's words", async () => {
    const all = fakeSupabase({ rpc: () => ({ data: [] }) });
    expect(await listActivity(tenantWith(all.client), {})).toEqual({ items: [], nextCursor: null });
    expect(all.rpcs[0].args).toEqual({ p_actor: null, p_entity_types: null, p_offset: 0, p_limit: 21 });
    const refused = fakeSupabase({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(listActivity(tenantWith(refused.client), {})).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
