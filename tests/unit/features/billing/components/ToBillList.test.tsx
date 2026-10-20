import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToBillVisit } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, list } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  list: { current: {} as { data?: unknown; isLoading?: boolean; error?: unknown } },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/useToBill", () => ({ useToBill: () => list.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { noCharge: vi.fn() } }));

const { ToBillList } = await import("@/features/billing/components/ToBillList");

const visit: ToBillVisit = {
  visitId: "v-1",
  day: "2026-10-18",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
  doctor: { id: "d-1", name: "Maya Rao" },
  appointmentId: null,
  token: null,
  treatments: [],
  feePaid: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view", "payments.create"] });
  list.current = { data: [visit] };
});

describe("ToBillList (plan §15.6; D318, D319)", () => {
  it("lists every doctor's visits to bill, each opening its sheet with Bill leading back to Billing", async () => {
    render(<ToBillList />, { wrapper: Providers });
    const row = within(screen.getByRole("list", { name: "To bill" })).getByRole("listitem");
    expect(row).toHaveTextContent("Maya Rao");
    await userEvent.click(within(row).getByRole("button", { name: "Check out Asha Rao’s visit" }));
    expect(screen.getByRole("link", { name: "Bill Asha Rao’s visit" })).toHaveAttribute(
      "href",
      "/billing/new?visit=v-1&from=billing",
    );
  });

  it("says when nothing waits, and offers no Bill to someone who may only read bills", () => {
    list.current = { data: [] };
    const first = render(<ToBillList />, { wrapper: Providers });
    expect(screen.getByRole("heading", { name: "Nothing to bill" })).toBeInTheDocument();
    first.unmount();

    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    list.current = { data: [visit] };
    render(<ToBillList />, { wrapper: Providers });
    expect(screen.queryByRole("button", { name: /^Check out/ })).not.toBeInTheDocument();
  });
});
