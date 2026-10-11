// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Tenant } from "@/lib/supabase/tenant";

const { listPatientAppointments } = vi.hoisted(() => ({ listPatientAppointments: vi.fn() }));
vi.mock("@/features/appointments/api", () => ({ listPatientAppointments }));

const { listPatientTimeline } = await import("@/features/patients/timeline");

const tenant = (permissions: Permission[]) =>
  ({ clinicId: "clinic-1", role: "STAFF", permissions }) as unknown as Tenant;

beforeEach(() => {
  vi.clearAllMocks();
  listPatientAppointments.mockResolvedValue({ items: [{ id: "a-1" }], nextCursor: null });
});

describe("listPatientTimeline (plan §10.3)", () => {
  it("gives a page of appointments to whoever sees them, from where it starts", async () => {
    const asked = tenant(["patients.view", "appointments.view"]);
    expect((await listPatientTimeline(asked, "p-1", 20)).items).toEqual([{ id: "a-1" }]);
    expect(listPatientAppointments).toHaveBeenCalledWith(asked, "p-1", 20);
  });

  it("gives anyone else an empty page, unread", async () => {
    expect(await listPatientTimeline(tenant(["patients.view"]), "p-1")).toEqual({ items: [], nextCursor: null });
    expect(listPatientAppointments).not.toHaveBeenCalled();
  });
});
