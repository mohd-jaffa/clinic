// @vitest-environment node
import { describe, expect, it } from "vitest";

import { medicineSuggestions } from "@/features/prescriptions/api";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as Tenant;
  return { ...fake, tenant };
}

describe("medicineSuggestions (D211)", () => {
  it("asks medicine_suggestions for what is typed and the doctor, and names each line the screen's way", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: [
          {
            medicine: "Paracetamol",
            strength: "500 mg",
            dose: "1 tab",
            frequency: "1-0-1",
            timing: "AFTER_FOOD",
            duration_days: 5,
            instructions: null,
          },
        ],
      }),
    });
    expect(await medicineSuggestions(tenant, { q: "para", doctorId: "d-1" })).toEqual([
      {
        medicine: "Paracetamol",
        strength: "500 mg",
        dose: "1 tab",
        frequency: "1-0-1",
        timing: "AFTER_FOOD",
        durationDays: 5,
        instructions: null,
      },
    ]);
    expect(rpcs).toEqual([{ name: "medicine_suggestions", args: { p_search: "para", p_doctor_id: "d-1" } }]);
  });

  it("passes on a refusal in the app's words", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(medicineSuggestions(tenant, { q: "para", doctorId: "d-1" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
