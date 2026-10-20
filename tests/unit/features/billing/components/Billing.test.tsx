import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, adding, count, clinic, paid } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
  count: { current: undefined as { count: number } | undefined },
  clinic: { current: undefined as { name: string; phone: string | null } | undefined },
  paid: { asked: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
vi.mock("@/features/billing/hooks/useToBillCount", () => ({ useToBillCount: () => ({ data: count.current }) }));
vi.mock("@/features/clinic/hooks/useClinic", () => ({ useClinic: () => ({ data: clinic.current }) }));
vi.mock("@/features/billing/components/ToBillList", () => ({ ToBillList: () => <p>To bill list</p> }));
vi.mock("@/features/billing/components/BillsList", () => ({
  BillsList: ({ range, shown }: { range: { kind: string }; shown: string }) => <p>{`Bills ${range.kind} ${shown}`}</p>,
}));
vi.mock("@/features/billing/components/PaymentsList", () => ({
  PaymentsList: ({ range }: { range: { kind: string } }) => <p>{`Payments ${range.kind}`}</p>,
}));
vi.mock("@/features/billing/components/OutstandingList", () => ({
  OutstandingList: ({
    clinic: from,
    canRecord,
    onRecord,
  }: {
    clinic: { name: string; phone: string | null };
    canRecord: boolean;
    onRecord: (owing: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onRecord({
          patient: {
            id: "p-1",
            name: "Rohan Mehta",
            number: 1042,
            phone: "+919876543210",
            dateOfBirth: "1990-01-01",
            gender: "MALE",
            archived: false,
          },
          balancePaise: 120_000,
        })
      }
    >
      {`Outstanding from ${from.name} ${from.phone ?? "no phone"} ${canRecord ? "records" : "reads"}`}
    </button>
  ),
}));
vi.mock("@/features/billing/components/RecordPaymentSheet", () => ({
  RecordPaymentSheet: ({
    open,
    patient,
  }: {
    open: boolean;
    patient?: { name: string; balancePaise: number } | null;
  }) => {
    if (open) paid.asked(patient ?? null);
    return open ? (
      <div role="dialog" aria-label={patient ? `Record payment from ${patient.name}` : "Record payment"} />
    ) : null;
  },
}));

const { Billing } = await import("@/features/billing/components/Billing");

const DESK: Permission[] = ["patients.view", "payments.view", "payments.create"];
const draw = () => render(<Billing />, { wrapper: Providers });

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: DESK });
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
  count.current = { count: 3 };
  clinic.current = { name: "Smile Dental", phone: "0484 234 5678" };
});

describe("Billing (plan §15.4; D318 – D325, D335)", () => {
  it("opens on To bill with how many wait, and offers New bill and Record payment", async () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Billing" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^To bill/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^To bill/ })).toHaveTextContent("3");
    expect(screen.getByText("To bill list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New bill" })).toHaveAttribute("href", "/billing/new?from=billing");
    await userEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(adding.current.show).toHaveBeenCalled();
  });

  it("opens Bills and Payments on Today, every state, and Outstanding from the clinic", async () => {
    draw();
    await userEvent.click(screen.getByRole("tab", { name: "Bills" }));
    expect(screen.getByText("Bills TODAY ALL")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByText("Payments TODAY")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Outstanding" }));
    expect(screen.getByText("Outstanding from Smile Dental 0484 234 5678 records")).toBeInTheDocument();
  });

  it("records a payment from someone who owes, the sheet named for them", async () => {
    draw();
    await userEvent.click(screen.getByRole("tab", { name: "Outstanding" }));
    await userEvent.click(screen.getByRole("button", { name: /^Outstanding from/ }));
    expect(screen.getByRole("dialog", { name: "Record payment from Rohan Mehta" })).toBeInTheDocument();
    expect(paid.asked).toHaveBeenLastCalledWith(expect.objectContaining({ id: "p-1", balancePaise: 120_000 }));
  });

  it("opens the sheet, searching, while the address names it — as the ＋ does (D323)", () => {
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.getByRole("dialog", { name: "Record payment" })).toBeInTheDocument();
    expect(paid.asked).toHaveBeenLastCalledWith(null);
  });

  it("reads only, for someone who may not bill, or in a view-only clinic, saying why; the clinic's name from the session", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    clinic.current = undefined;
    count.current = undefined;
    const first = draw();
    expect(screen.queryByRole("link", { name: "New bill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Outstanding" }));
    expect(screen.getByText(/ no phone reads$/)).toBeInTheDocument();
    first.unmount();

    const stub = authStub({ role: "STAFF", permissions: DESK });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("link", { name: "New bill" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });

  it("names no clinic with no membership", async () => {
    auth.current = { ...authStub({ role: "STAFF", permissions: DESK }), membership: null } as never;
    clinic.current = undefined;
    draw();
    await userEvent.click(screen.getByRole("tab", { name: "Outstanding" }));
    expect(within(screen.getByRole("tabpanel")).getByRole("button")).toHaveTextContent(
      "Outstanding from no phone reads",
    );
  });
});
