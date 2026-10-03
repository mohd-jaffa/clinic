import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SUBSCRIPTION_STATES } from "@/constants/statuses";
import { aSession, authStub } from "@tests/support/auth";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { useReadOnly } = await import("@/features/subscription/hooks/useReadOnly");

const { subscription } = aSession();

beforeEach(() => {
  auth.current = authStub();
});

describe("useReadOnly (plan §7.2)", () => {
  it.each(SUBSCRIPTION_STATES)("is view-only only in READ_ONLY: %s", (state) => {
    auth.current = authStub({ subscription: { ...subscription!, state } });
    const { result } = renderHook(() => useReadOnly());
    expect(result.current).toEqual({
      readOnly: state === "READ_ONLY",
      reason: "Your clinic is view-only until its plan is renewed.",
    });
  });

  it("is not view-only with no plan — the platform admin, or no one yet", () => {
    auth.current = authStub({ subscription: null });
    expect(renderHook(() => useReadOnly()).result.current.readOnly).toBe(false);
  });
});
