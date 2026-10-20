import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { ToBillVisit } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { noCharge: vi.fn() } }));

const { ToBillPanel } = await import("@/features/billing/components/ToBillPanel");

const visit: ToBillVisit = {
  visitId: "v-1",
  day: "2026-10-18",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
  doctor: { id: "d-1", name: "Maya Rao" },
  appointmentId: "a-1",
  token: 7,
  treatments: ["Root canal"],
  feePaid: true,
};
const DESK: Permission[] = ["patients.view", "payments.view", "payments.create"];
const onClose = vi.fn();
const draw = (shown: ToBillVisit | null = visit) =>
  render(<ToBillPanel visit={shown} open onClose={onClose} from="billing" />, { wrapper: Providers });
const sheet = () => screen.getByRole("dialog", { name: "Asha Rao’s visit" });

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: DESK });
});

describe("ToBillPanel (plan §15.6; D319)", () => {
  it("shows the visit — doctor, day, token, what was done — with Bill, leading back where it was opened", () => {
    draw();
    expect(within(sheet()).getByText("Fee paid")).toBeInTheDocument();
    expect(within(sheet()).getByText("Maya Rao")).toBeInTheDocument();
    expect(within(sheet()).getByText("18 Oct 2026")).toBeInTheDocument();
    expect(within(sheet()).getByText("#7")).toBeInTheDocument();
    expect(within(sheet()).getByText("Root canal")).toBeInTheDocument();
    expect(within(sheet()).getByRole("link", { name: "Bill Asha Rao’s visit" })).toHaveAttribute(
      "href",
      "/billing/new?visit=v-1&from=billing",
    );
  });

  it("opens No charge over it, and comes back when that closes", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Mark Asha Rao’s visit No charge" }));
    const reason = screen.getByRole("dialog", { name: "No charge" });
    await userEvent.click(within(reason).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("names a former doctor, or none, and leaves out a token and work it does not have", () => {
    draw({ ...visit, doctor: { id: "d-1", name: null }, token: null, treatments: [], feePaid: true });
    expect(within(sheet()).getByText("No longer on the team")).toBeInTheDocument();
    expect(within(sheet()).queryByText("Token")).not.toBeInTheDocument();
    expect(within(sheet()).queryByText("What was done")).not.toBeInTheDocument();
  });

  it("says to restore an archived patient, and offers no Bill to someone who may not bill or to a view-only clinic", () => {
    const first = draw({ ...visit, doctor: null, patient: { ...visit.patient, archived: true } });
    expect(within(sheet()).getByText("No doctor")).toBeInTheDocument();
    expect(within(sheet()).getByText("Archived: restore them to bill this visit.")).toBeInTheDocument();
    expect(within(sheet()).queryByRole("link", { name: /^Bill/ })).not.toBeInTheDocument();
    first.unmount();

    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    const second = draw();
    expect(within(sheet()).queryByRole("link", { name: /^Bill/ })).not.toBeInTheDocument();
    second.unmount();

    const stub = authStub({ role: "STAFF", permissions: DESK });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(within(sheet()).queryByRole("button", { name: /No charge$/ })).not.toBeInTheDocument();
  });

  it("is nothing with no visit opened", () => {
    draw(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
