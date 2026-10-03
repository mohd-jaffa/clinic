import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import { aDeveloperSession, authStub } from "@tests/support/auth";

const { router, auth } = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/patients/p-1",
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { RequireAuth } = await import("@/features/auth/components/RequireAuth");

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
});

const screenUnder = () =>
  render(
    <RequireAuth>
      <p>Patient profile</p>
    </RequireAuth>,
  );

describe("the session gate", () => {
  it("draws the screen for a signed-in member", () => {
    screenUnder();

    expect(screen.getByText("Patient profile")).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows nothing of the screen while it does not yet know who is asking, only its land", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    screenUnder();

    // It is there, starting its own work, but out of sight and out of reach.
    expect(screen.getByText("Patient profile")).not.toBeVisible();
    expect(screen.getByRole("status", { name: UI_TEXT.auth.checkingSession })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("starts the screen while the session is checked, and keeps it — not mounted twice — once it is known", () => {
    const mounted = vi.fn();
    function Screen() {
      useEffect(() => mounted(), []);
      return <p>Patient profile</p>;
    }
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    const { rerender } = render(
      <RequireAuth>
        <Screen />
      </RequireAuth>,
    );
    expect(mounted).toHaveBeenCalledOnce();

    auth.current = authStub();
    rerender(
      <RequireAuth>
        <Screen />
      </RequireAuth>,
    );
    expect(screen.getByText("Patient profile")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mounted).toHaveBeenCalledOnce();
  });

  it("sends a visitor with no session to sign in, remembering where they were", async () => {
    auth.current = authStub({ status: "anonymous", profile: null, membership: null });
    screenUnder();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fpatients%2Fp-1"));
    expect(screen.queryByText("Patient profile")).not.toBeInTheDocument();
  });

  it("sends the platform admin, who belongs to no clinic, to the developer console (plan §3.2)", async () => {
    const { profile } = aDeveloperSession();
    auth.current = authStub({ profile, membership: null, subscription: null });
    screenUnder();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("Patient profile")).not.toBeInTheDocument();
  });
});
