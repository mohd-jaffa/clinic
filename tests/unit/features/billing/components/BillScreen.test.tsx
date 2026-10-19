import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { BillDetail } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, bill, params } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  bill: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean } },
  params: { current: "" },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/useBill", () => ({ useBill: () => bill.current }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { void: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(params.current) }));

const { BillScreen } = await import("@/features/billing/components/BillScreen");

const VISIT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const issued: BillDetail = {
  id: "b-1",
  number: "2026-27/0042",
  issuedAt: "2026-10-16T05:30:00Z",
  issuedOn: "2026-10-16",
  status: "ISSUED",
  patient: {
    id: "p-1",
    name: "Asha Rao",
    number: 1042,
    phone: "+919876543210",
    dateOfBirth: "1990-01-01",
    gender: "FEMALE",
    archived: false,
  },
  visitId: VISIT,
  appointmentId: null,
  doctor: "Maya Rao",
  lines: [
    {
      description: "Consultation",
      quantity: 1,
      unitPricePaise: 80_000,
      amountPaise: 80_000,
      serviceId: "s-1",
      treatmentId: null,
    },
    {
      description: "Dressing kit",
      quantity: 3,
      unitPricePaise: 4_000,
      amountPaise: 12_000,
      serviceId: null,
      treatmentId: null,
    },
  ],
  subtotalPaise: 92_000,
  discountPaise: 2_000,
  totalPaise: 90_000,
  notes: "Paid by her son",
  issuedBy: "Priya Shah",
  void: null,
  settlement: { paidPaise: 50_000, duePaise: 40_000, state: "PART_PAID" },
  balancePaise: 40_000,
};
const voided: BillDetail = {
  ...issued,
  status: "VOID",
  void: { reason: "Wrong patient", at: "2026-10-17T05:30:00Z", by: "Asha Menon" },
  settlement: null,
};

const EVERYTHING: Permission[] = ["patients.view", "payments.view", "payments.create", "payments.edit"];
const as = (permissions: Permission[]) => (auth.current = authStub({ role: "STAFF", permissions }));
const draw = () => render(<BillScreen id="b-1" />, { wrapper: Providers });
const figure = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

beforeEach(() => {
  vi.clearAllMocks();
  as(EVERYTHING);
  bill.current = { data: issued };
  params.current = "";
});

describe("BillScreen (plan §15.2; D314)", () => {
  it("heads the page with the bill, the patient, the day and doctor, and where it stands", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Bill 2026-27/0042" })).toBeInTheDocument();
    expect(screen.getByText(/^Asha Rao · 36 y/)).toBeInTheDocument();
    expect(screen.getByText("Issued 16 Oct 2026 · Maya Rao")).toBeInTheDocument();
    expect(screen.getByText("Part paid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/billing");
  });

  it("lists its lines, notes and figures — paid and due on it, and the patient's balance", () => {
    draw();
    const lines = screen.getByRole("region", { name: "Lines" });
    expect(within(lines).getByText("Dressing kit")).toBeInTheDocument();
    expect(within(lines).getByText("3 × ₹40")).toBeInTheDocument();
    expect(within(lines).getByText("₹120")).toBeInTheDocument();
    expect(within(lines).getByText("Paid by her son")).toBeInTheDocument();
    expect(figure("Subtotal")).toHaveTextContent("₹920");
    expect(figure("Discount")).toHaveTextContent("−₹20");
    expect(figure("Total")).toHaveTextContent("₹900");
    expect(figure("Paid")).toHaveTextContent("₹500");
    expect(figure("Due on this bill")).toHaveTextContent("₹400");
    expect(figure("Patient’s balance")).toHaveTextContent("₹400 due");
    expect(screen.getByText("Issued by Priya Shah")).toBeInTheDocument();
  });

  it("prints, downloads, voids for payments.edit — asking a reason — and leads to the profile", async () => {
    draw();
    expect(screen.getByRole("link", { name: "Print bill 2026-27/0042" })).toHaveAttribute(
      "href",
      "/api/bills/b-1/bill.pdf",
    );
    expect(screen.getByRole("button", { name: "Download bill 2026-27/0042" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Asha Rao’s profile" })).toHaveAttribute("href", "/patients/p-1");
    expect(screen.queryByRole("link", { name: /^Re-issue/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Void bill" }));
    const sheet = screen.getByRole("dialog", { name: "Void bill" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Void bill" })).not.toBeInTheDocument();
  });

  it("offers no Void without payments.edit, in a view-only clinic, or for an archived patient", () => {
    as(["patients.view", "payments.view"]);
    const first = draw();
    expect(screen.queryByRole("button", { name: "Void bill" })).not.toBeInTheDocument();
    first.unmount();

    const stub = authStub({ role: "STAFF", permissions: EVERYTHING });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    const second = draw();
    expect(screen.queryByRole("button", { name: "Void bill" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
    second.unmount();

    as(EVERYTHING);
    bill.current = { data: { ...issued, patient: { ...issued.patient, archived: true } } };
    draw();
    expect(screen.queryByRole("button", { name: "Void bill" })).not.toBeInTheDocument();
  });

  it("says when, by whom and why a void bill was voided, with no payment on it — and re-issues it", () => {
    bill.current = { data: voided };
    draw();
    expect(screen.getByText("Void")).toBeInTheDocument();
    expect(screen.getByText("Voided 17 Oct 2026 by Asha Menon")).toBeInTheDocument();
    expect(screen.getByText("Void: Wrong patient")).toBeInTheDocument();
    expect(screen.queryByText("Paid", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void bill" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Re-issue bill 2026-27/0042" })).toHaveAttribute(
      "href",
      `/billing/new?visit=${VISIT}&reissue=b-1`,
    );
  });

  it("re-issues an arrival's bill for the arrival, and a patient's for the patient; not without payments.create", () => {
    bill.current = { data: { ...voided, visitId: null, appointmentId: "a-1", void: { ...voided.void!, by: null } } };
    const first = draw();
    expect(screen.getByText("Voided 17 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Re-issue/ })).toHaveAttribute(
      "href",
      "/billing/new?appointment=a-1&reissue=b-1",
    );
    first.unmount();

    bill.current = { data: { ...voided, visitId: null } };
    const second = draw();
    expect(screen.getByRole("link", { name: /^Re-issue/ })).toHaveAttribute(
      "href",
      "/billing/new?patient=p-1&reissue=b-1",
    );
    second.unmount();

    as(["patients.view", "payments.view", "payments.edit"]);
    draw();
    expect(screen.queryByRole("link", { name: /^Re-issue/ })).not.toBeInTheDocument();
  });

  it("leaves out what it does not have — a discount, notes, a doctor, who issued it", () => {
    bill.current = { data: { ...issued, discountPaise: 0, notes: null, doctor: null, issuedBy: null } };
    draw();
    expect(screen.queryByText("Discount", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.getByText("Issued 16 Oct 2026 · No doctor")).toBeInTheDocument();
    expect(screen.queryByText(/^Issued by/)).not.toBeInTheDocument();
  });

  it("leads back to the profile it was opened from (D325)", () => {
    params.current = "from=patient";
    draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/patients/p-1");
  });

  it("says when it could not be read, with Try again, and waits while it reads", () => {
    bill.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    const first = draw();
    expect(screen.getByText("This bill couldn't be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bill" })).toBeInTheDocument();
    first.unmount();

    bill.current = {};
    draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
  });
});
