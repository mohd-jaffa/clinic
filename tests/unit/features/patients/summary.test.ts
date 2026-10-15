// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Tenant } from "@/lib/supabase/tenant";

const { nextAppointment, listPatientTreatments } = vi.hoisted(() => ({
  nextAppointment: vi.fn(),
  listPatientTreatments: vi.fn(),
}));
vi.mock("@/features/appointments/api", () => ({ nextAppointment }));
vi.mock("@/features/treatments/api", () => ({ listPatientTreatments }));

const { getPatientSummary } = await import("@/features/patients/summary");

const tenant = (permissions: Permission[]) =>
  ({ clinicId: "clinic-1", role: "STAFF", permissions }) as unknown as Tenant;

beforeEach(() => {
  vi.clearAllMocks();
  nextAppointment.mockResolvedValue({ id: "a-1" });
  listPatientTreatments.mockResolvedValue([{ id: "t-1" }]);
});

describe("getPatientSummary (plan §10.3)", () => {
  it("gives the next appointment to whoever sees appointments", async () => {
    const asked = tenant(["patients.view", "appointments.view"]);
    expect(await getPatientSummary(asked, "p-1")).toEqual({ nextAppointment: { id: "a-1" } });
    expect(nextAppointment).toHaveBeenCalledWith(asked, "p-1");
    expect(listPatientTreatments).not.toHaveBeenCalled();
  });

  it("gives the treatments to whoever sees visits (D260), both read at once", async () => {
    const asked = tenant(["patients.view", "appointments.view", "visits.view"]);
    expect(await getPatientSummary(asked, "p-1")).toEqual({
      nextAppointment: { id: "a-1" },
      treatments: [{ id: "t-1" }],
    });
    expect(listPatientTreatments).toHaveBeenCalledWith(asked, "p-1");
    nextAppointment.mockResolvedValue(null);
    expect(await getPatientSummary(tenant(["visits.view"]), "p-1")).toEqual({ treatments: [{ id: "t-1" }] });
  });

  it("leaves both out, unread, for anyone else", async () => {
    expect(await getPatientSummary(tenant(["patients.view"]), "p-1")).toEqual({});
    expect(nextAppointment).not.toHaveBeenCalled();
    expect(listPatientTreatments).not.toHaveBeenCalled();
  });
});
