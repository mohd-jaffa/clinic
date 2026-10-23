import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, summary, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  summary: { current: {} as { data?: { balancePaise?: number }; error?: unknown; mutate?: () => void } },
  client: { record: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/hooks/usePatientSummary", () => ({ usePatientSummary: () => summary.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

const { PatientBalance } = await import("@/features/billing/components/PatientBalance");

const patient = { ...aPatient(), id: "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b" };
const draw = (overrides: Partial<typeof patient> = {}) =>
  render(<PatientBalance patient={{ ...patient, ...overrides }} />, { wrapper: Providers });
const section = () => screen.getByRole("region", { name: "Balance" });
const owing = (balancePaise: number) => (summary.current = { data: { balancePaise } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
  auth.current = authStub();
  owing(120_000);
  client.record.mockResolvedValue({ paymentId: "pay-1", balancePaise: 0 });
});

afterEach(() => vi.useRealTimers());

describe("PatientBalance (plan §10.3; D295, D322, D324)", () => {
  it("says what they owe, in coral, with Record payment filled with it, for them — and no Refund", async () => {
    draw();
    const due = within(section()).getByText("₹1,200 due");
    expect(due).toHaveClass("text-coral");
    expect(within(section()).queryByRole("button", { name: `Refund ${patient.name}` })).not.toBeInTheDocument();
    await userEvent.click(within(section()).getByRole("button", { name: `Record a payment from ${patient.name}` }));
    const sheet = screen.getByRole("dialog", { name: "Record payment" });
    expect(within(sheet).getByText(patient.name)).toBeInTheDocument();
    expect(within(sheet).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(sheet).getByRole("textbox", { name: /^Amount/ })).toHaveValue("1200");
    await userEvent.click(within(sheet).getByRole("button", { name: "Record payment" }));
    await waitFor(() =>
      expect(client.record).toHaveBeenCalledWith({
        input: expect.objectContaining({ patientId: patient.id, kind: "PAYMENT", amount: "1200" }),
        key: expect.any(String),
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Record payment" })).not.toBeInTheDocument());
  });

  it("offers Refund while they hold an advance, filled with it (D297, D322)", async () => {
    owing(-30_000);
    draw();
    expect(within(section()).getByText("₹300 advance")).toHaveClass("text-ink");
    await userEvent.click(within(section()).getByRole("button", { name: `Refund ${patient.name}` }));
    const sheet = screen.getByRole("dialog", { name: "Refund" });
    expect(within(sheet).getByRole("textbox", { name: /^Amount/ })).toHaveValue("300");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Refund" })).not.toBeInTheDocument());
  });

  it("says nothing is due, with Record payment empty — an advance in the making", async () => {
    summary.current = { data: {} };
    draw();
    expect(within(section()).getByText("Nothing due")).toHaveClass("text-muted");
    await userEvent.click(within(section()).getByRole("button", { name: `Record a payment from ${patient.name}` }));
    expect(
      within(screen.getByRole("dialog", { name: "Record payment" })).getByRole("textbox", { name: /^Amount/ }),
    ).toHaveValue("");
  });

  it("offers Refund only with payments.edit, and neither to whoever only reads bills", () => {
    owing(-30_000);
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view", "payments.create"] });
    const { unmount } = draw();
    expect(within(section()).getByRole("button", { name: /^Record a payment/ })).toBeInTheDocument();
    expect(within(section()).queryByRole("button", { name: /^Refund/ })).not.toBeInTheDocument();
    unmount();
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    draw();
    expect(within(section()).getByText("₹300 advance")).toBeInTheDocument();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("takes nothing for an archived patient — restored first (D300) — nor in a view-only clinic, which says why", () => {
    owing(-30_000);
    const { unmount } = draw({ archivedAt: "2026-10-01T00:00:00Z" });
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    unmount();
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(section()).getByText(/view-only/)).toBeInTheDocument();
  });

  it("stands in while it loads, and says when it could not, with Try again", async () => {
    summary.current = {};
    const { unmount } = draw();
    expect(within(section()).getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    unmount();
    const mutate = vi.fn();
    summary.current = { error: new Error("down"), mutate };
    draw();
    expect(within(section()).getByText("The balance couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(within(section()).getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });

  it("is signed out of everything", () => {
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(within(section()).queryByRole("button")).not.toBeInTheDocument();
  });
});
