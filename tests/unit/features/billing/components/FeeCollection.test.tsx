import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillStart } from "@/features/billing/types";
import type { Service } from "@/features/clinic/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth, start, services, asked } = vi.hoisted(() => ({
  client: { issue: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  start: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean } },
  services: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean } },
  asked: [] as unknown[],
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/useBillStart", () => ({
  useBillStart: (target: unknown) => {
    asked.push(target);
    return start.current;
  },
}));
vi.mock("@/features/clinic/hooks/useServices", () => ({ useServices: () => services.current }));

const { FeeCollectionProvider, useCollectFee } = await import("@/features/billing/components/FeeCollection");

const APPOINTMENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const PATIENT = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const CONSULTATION: Service = {
  id: "5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a51",
  name: "Consultation",
  category: "CONSULTATION",
  pricePaise: 50_000,
  active: true,
};
const arrival: BillStart = {
  patient: {
    id: PATIENT,
    name: "Rohan Mehta",
    number: 1012,
    dateOfBirth: "1990-01-01",
    gender: "MALE",
    archived: false,
  },
  visit: null,
  appointment: { id: APPOINTMENT, status: "ARRIVED", token: 7 },
  doctor: { id: "d-1", name: "Maya Rao", feePaise: 80_000 },
  consultationBilled: false,
  treatments: [],
  balancePaise: 0,
  toBill: null,
};

/** An arrival, as the queue makes one: it closes, and Collect fee follows. */
function Arrive({ token = 7 as number | null }) {
  const offerFee = useCollectFee();
  return (
    <button
      type="button"
      onClick={() => offerFee({ appointmentId: APPOINTMENT, patientName: "Rohan Mehta", doctorName: null, token })}
    >
      Arrived
    </button>
  );
}

const draw = (token: number | null = 7) =>
  render(
    <Providers>
      <FeeCollectionProvider>
        <Arrive token={token} />
      </FeeCollectionProvider>
    </Providers>,
  );
const sheet = () => screen.getByRole("dialog", { name: "Collect fee" });
const arrive = () => userEvent.click(screen.getByRole("button", { name: "Arrived" }));

beforeEach(() => {
  vi.clearAllMocks();
  asked.length = 0;
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.edit", "payments.create"] });
  start.current = { data: arrival };
  services.current = { data: [CONSULTATION] };
  client.issue.mockResolvedValue({
    billId: "b-1",
    billNumber: "2026-27/0007",
    totalPaise: 80_000,
    collectedPaise: 80_000,
    balancePaise: 0,
  });
});

describe("Collect fee (plan §11.3; D283, D305)", () => {
  it("opens on nothing until an arrival offers it, then says the token and the doctor's fee", async () => {
    draw();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await arrive();
    expect(asked).toContainEqual({ appointment: APPOINTMENT });
    expect(within(sheet()).getByText(/Rohan Mehta is #7 with/)).toBeInTheDocument();
    // Without permission to change prices, the fee is its read-out.
    expect(within(sheet()).queryByRole("textbox", { name: /^Consultation fee/ })).not.toBeInTheDocument();
    expect(within(sheet()).getByText("₹800")).toBeInTheDocument();
  });

  it("charges the price list's Consultation when the doctor is gone, and offers nothing outside the provider", async () => {
    start.current = { data: { ...arrival, doctor: null } };
    const first = draw();
    await arrive();
    expect(within(sheet()).getByText("₹500")).toBeInTheDocument();
    first.unmount();

    render(
      <Providers>
        <Arrive />
      </Providers>,
    );
    await arrive();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("issues the arrival's consultation bill with its payment, and says so", async () => {
    draw();
    await arrive();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "UPI" }));
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reference/ }), "UTR 7");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Issue and collect" }));
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect((client.issue.mock.calls[0][0] as { input: unknown }).input).toEqual({
      patientId: PATIENT,
      visitId: null,
      appointmentId: APPOINTMENT,
      lines: [{ kind: "SERVICE", serviceId: CONSULTATION.id, treatmentId: null, quantity: 1, price: "800" }],
      discount: { kind: "NONE" },
      notes: "",
      collect: { on: true, amount: "800", method: "UPI", reference: "UTR 7" },
    });
    expect((await screen.findAllByText("Bill 2026-27/0007 issued"))[0]).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Collect fee" })).not.toBeInTheDocument());
  });

  it("lets whoever may change prices change the fee, refused when it is not an amount", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create", "payments.discount"] });
    draw(null);
    await arrive();
    expect(within(sheet()).queryByText(/is #/)).not.toBeInTheDocument();
    const fee = within(sheet()).getByRole("textbox", { name: /^Consultation fee/ });
    await userEvent.clear(fee);
    await userEvent.type(fee, "lots");
    // Not an amount yet: nothing to collect, so no method.
    expect(within(sheet()).queryByRole("radiogroup", { name: "Method" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Issue and collect" }));
    expect(await within(sheet()).findByText("Consultation fee must be a valid amount.")).toBeInTheDocument();
    expect(client.issue).not.toHaveBeenCalled();
  });

  it("skips, leaving the fee for checkout", async () => {
    draw();
    await arrive();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Collect fee" })).not.toBeInTheDocument());
    expect(client.issue).not.toHaveBeenCalled();
  });

  it("says when the fee is paid already, or there is no consultation to bill — Skip only", async () => {
    start.current = { data: { ...arrival, consultationBilled: true } };
    const first = draw();
    await arrive();
    expect(within(sheet()).getByText("Rohan Mehta’s fee is already paid.")).toBeInTheDocument();
    expect(within(sheet()).queryByRole("button", { name: "Issue and collect" })).not.toBeInTheDocument();
    first.unmount();

    start.current = { data: arrival };
    services.current = { data: [{ ...CONSULTATION, active: false }] };
    draw();
    await arrive();
    expect(
      within(sheet()).getByText(
        "The price list has no Consultation to bill. Add one in Settings, or bill at checkout.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Skip" }));
  });

  it("says when it could not read what to bill, or the price list, and waits while it reads", async () => {
    const mutate = vi.fn();
    start.current = { error: new Error("down"), mutate, isValidating: false };
    const first = draw();
    await arrive();
    expect(within(sheet()).getByText("What to bill couldn't be loaded.")).toBeInTheDocument();
    first.unmount();

    start.current = {};
    services.current = { error: new Error("down"), mutate, isValidating: false };
    const second = draw();
    await arrive();
    expect(within(sheet()).getByText("The price list couldn't be loaded.")).toBeInTheDocument();
    second.unmount();

    services.current = {};
    draw();
    await arrive();
    expect(within(sheet()).getByRole("region", { name: "Loading…" })).toBeInTheDocument();
  });
});
