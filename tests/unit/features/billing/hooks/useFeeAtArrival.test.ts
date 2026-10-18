import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";

const { auth, clinic, readOnly } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  clinic: { current: undefined as { feeTiming: string } | undefined },
  readOnly: { current: false },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/hooks/useClinic", () => ({ useClinic: () => ({ data: clinic.current }) }));
vi.mock("@/features/subscription/hooks/useReadOnly", () => ({
  useReadOnly: () => ({ readOnly: readOnly.current, reason: "View-only" }),
}));

const { useFeeAtArrival } = await import("@/features/billing/hooks/useFeeAtArrival");

const offered = () => renderHook(() => useFeeAtArrival()).result.current;

beforeEach(() => {
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create"] });
  clinic.current = { feeTiming: "AT_ARRIVAL" };
  readOnly.current = false;
});

describe("useFeeAtArrival (plan §11.3; D283, D305)", () => {
  it("goes on to Collect fee in a clinic that takes the fee at arrival, for whoever may issue a bill", () => {
    expect(offered()).toBe(true);
  });

  it("does not after the consultation, before the clinic is read, without the permission, or view-only", () => {
    clinic.current = { feeTiming: "AFTER_CONSULTATION" };
    expect(offered()).toBe(false);
    clinic.current = undefined;
    expect(offered()).toBe(false);
    clinic.current = { feeTiming: "AT_ARRIVAL" };
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.edit"] });
    expect(offered()).toBe(false);
    auth.current = { ...authStub(), membership: null };
    expect(offered()).toBe(false);
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create"] });
    readOnly.current = true;
    expect(offered()).toBe(false);
  });
});
