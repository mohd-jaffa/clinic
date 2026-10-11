// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Tenant } from "@/lib/supabase/tenant";

const { nextAppointment } = vi.hoisted(() => ({ nextAppointment: vi.fn() }));
vi.mock("@/features/appointments/api", () => ({ nextAppointment }));

const { getPatientSummary } = await import("@/features/patients/summary");

const tenant = (permissions: Permission[]) =>
  ({ clinicId: "clinic-1", role: "STAFF", permissions }) as unknown as Tenant;

beforeEach(() => {
  vi.clearAllMocks();
  nextAppointment.mockResolvedValue({ id: "a-1" });
});

describe("getPatientSummary (plan §10.3)", () => {
  it("gives the next appointment to whoever sees appointments", async () => {
    const asked = tenant(["patients.view", "appointments.view"]);
    expect(await getPatientSummary(asked, "p-1")).toEqual({ nextAppointment: { id: "a-1" } });
    expect(nextAppointment).toHaveBeenCalledWith(asked, "p-1");
  });

  it("leaves it out, unread, for anyone else", async () => {
    expect(await getPatientSummary(tenant(["patients.view"]), "p-1")).toEqual({});
    expect(nextAppointment).not.toHaveBeenCalled();
  });
});
