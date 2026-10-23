import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { noCharge: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

const { NoChargeButton } = await import("@/features/billing/components/NoChargeButton");

const waiting = {
  id: "v-1",
  billingStatus: "TO_BILL" as const,
  patient: { id: "p-1", name: "Asha Rao", archived: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create"] });
  client.noCharge.mockResolvedValue({ visitId: "v-1" });
});

describe("NoChargeButton (plan §15.6; D319)", () => {
  it("opens the reason on a done visit waiting in To bill, and closes once marked", async () => {
    render(<NoChargeButton visit={waiting} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Mark Asha Rao’s visit No charge" }));
    const sheet = screen.getByRole("dialog", { name: "No charge" });
    expect(sheet).toHaveTextContent("Asha Rao’s visit");
    await userEvent.click(screen.getByRole("button", { name: "Mark No charge" }));
    await waitFor(() =>
      expect(client.noCharge).toHaveBeenCalledWith({ visitId: "v-1", input: { reason: "REVIEW", note: "" } }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "No charge" })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Asha Rao’s visit marked No charge");
  });

  it("closes without marking when the reason is left", async () => {
    render(<NoChargeButton visit={waiting} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Mark Asha Rao’s visit No charge" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "No charge" })).not.toBeInTheDocument());
    expect(client.noCharge).not.toHaveBeenCalled();
  });

  it("is not there once billed or settled, while open, for an archived patient, without payments.create, signed out, or view-only", () => {
    const shown = (visit: Parameters<typeof NoChargeButton>[0]["visit"]) => {
      const { unmount } = render(<NoChargeButton visit={visit} />, { wrapper: Providers });
      const any = screen.queryByRole("button", { name: "Mark Asha Rao’s visit No charge" }) !== null;
      unmount();
      return any;
    };
    expect(shown(waiting)).toBe(true);
    expect(shown({ ...waiting, billingStatus: "BILLED" })).toBe(false);
    expect(shown({ ...waiting, billingStatus: "NO_CHARGE" })).toBe(false);
    expect(shown({ ...waiting, billingStatus: null })).toBe(false);
    expect(shown({ ...waiting, patient: { ...waiting.patient, archived: true } })).toBe(false);
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    expect(shown(waiting)).toBe(false);
    auth.current = { ...authStub(), membership: null };
    expect(shown(waiting)).toBe(false);
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    expect(shown(waiting)).toBe(false);
  });
});
