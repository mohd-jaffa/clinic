import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { BillDetail, BillStart } from "@/features/billing/types";
import type { Service } from "@/features/clinic/types";
import type { PatientListItem } from "@/features/patients/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth, start, services, search, router, params, reissued } = vi.hoisted(() => ({
  client: { issue: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  start: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean } },
  services: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean } },
  search: { current: undefined as unknown },
  router: { replace: vi.fn(), push: vi.fn() },
  params: { current: "" },
  reissued: {
    current: {} as { data?: unknown; error?: unknown; mutate?: () => void; isValidating?: boolean },
    asked: [] as unknown[],
  },
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/useBillStart", () => ({ useBillStart: () => start.current }));
vi.mock("@/features/clinic/hooks/useServices", () => ({ useServices: () => services.current }));
vi.mock("@/features/billing/hooks/useBill", () => ({
  useBill: (id: unknown) => {
    reissued.asked.push(id);
    return reissued.current;
  },
}));
vi.mock("@/features/patients/hooks/usePatientSearch", () => ({ usePatientSearch: () => ({ data: search.current }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(params.current),
}));

const { NewBill } = await import("@/features/billing/components/NewBill");

const VISIT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const PATIENT = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const entry = (id: string, name: string, category: Service["category"], pricePaise: number): Service => ({
  id,
  name,
  category,
  pricePaise,
  active: true,
});
const CONSULTATION = entry("5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a51", "Consultation", "CONSULTATION", 50_000);
const ROOT_CANAL = entry("5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a52", "Root canal", "PROCEDURE", 600_000);
const CROWN = entry("5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a53", "Crown cap", "PROCEDURE", 400_000);
const XRAY = entry("5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a54", "X-ray", "INVESTIGATION", 40_000);
const ROOT_CANAL_TREATMENT = "6b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a51";
const CROWN_TREATMENT = "6b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a52";
const PRICE_LIST = [
  CONSULTATION,
  ROOT_CANAL,
  CROWN,
  XRAY,
  { ...entry("5b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a55", "Old", "OTHER", 1), active: false },
];

const visitStart: BillStart = {
  patient: {
    id: PATIENT,
    name: "Asha Rao",
    number: 1042,
    dateOfBirth: "1990-01-01",
    gender: "FEMALE",
    phone: "+919876543210",
    archived: false,
  },
  visit: { id: VISIT, day: "2026-10-16", status: "COMPLETED", billingStatus: "TO_BILL" },
  appointment: null,
  doctor: { id: "d-1", name: "Maya Rao", feePaise: 80_000 },
  doctors: [],
  consultationBilled: false,
  treatments: [
    { id: ROOT_CANAL_TREATMENT, name: "Root canal" },
    { id: CROWN_TREATMENT, name: "Crown" },
  ],
  balancePaise: 20_000,
  toBill: null,
};

const DISCOUNTS: Permission[] = ["patients.view", "payments.create", "payments.discount"];
const DESK: Permission[] = ["patients.view", "payments.view", "payments.create"];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: DESK });
  start.current = { data: visitStart };
  services.current = { data: PRICE_LIST };
  params.current = `visit=${VISIT}`;
  reissued.current = {};
  reissued.asked.length = 0;
  client.issue.mockResolvedValue({
    billId: "b-1",
    billNumber: "2026-27/0042",
    totalPaise: 0,
    collectedPaise: 0,
    balancePaise: 0,
  });
});

const draw = () => render(<NewBill />, { wrapper: Providers });
const lineOf = (name: RegExp | string) => screen.getByRole("group", { name });
const issue = () => userEvent.click(screen.getByRole("button", { name: "Issue bill" }));
const sent = () => (client.issue.mock.calls[0][0] as { input: Record<string, unknown> }).input;
const figure = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

describe("NewBill (plan §15.2; D302 – D313)", () => {
  it("starts a visit's bill with its consultation at the fee, its treatments, and a reminder for one unpriced", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "New bill" })).toBeInTheDocument();
    expect(screen.getByText(/^Asha Rao · /)).toBeInTheDocument();
    expect(screen.getByText("Visit 16 Oct · Maya Rao")).toBeInTheDocument();
    // Its price, and what the line comes to.
    expect(within(lineOf("Consultation")).getAllByText("₹800")).toHaveLength(2);
    expect(within(lineOf("Root canal")).getByText("For Root canal")).toBeInTheDocument();
    expect(lineOf(/Crown: pick its price-list entry/)).toBeInTheDocument();
    // Without permission to change prices, each price is its read-out (D309).
    expect(screen.queryByRole("textbox", { name: /^Price/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Discount as" })).not.toBeInTheDocument();
    expect(figure("Subtotal")).toHaveTextContent("₹6,800");
    expect(figure("Balance now")).toHaveTextContent("₹200 due");
  });

  it("issues nothing until the reminder has its entry, then issues it and goes back to the visit (D302, D308)", async () => {
    draw();
    await issue();
    expect(await screen.findByText("Pick a price-list entry for Crown, or remove the line.")).toBeInTheDocument();
    expect(client.issue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Pick a price-list entry for Crown" }));
    const sheet = screen.getByRole("dialog", { name: "Entry for Crown" });
    // Picking for a treatment offers the price list alone.
    expect(within(sheet).queryByRole("button", { name: "Add typed line" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: /Crown cap/ }));
    expect(within(lineOf("Crown cap")).getByText("For Crown")).toBeInTheDocument();
    expect(figure("Total")).toHaveTextContent("₹10,800");

    await issue();
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect(sent()).toEqual({
      patientId: PATIENT,
      visitId: VISIT,
      appointmentId: null,
      // A visit's bill keeps the visit's doctor: none is sent (D342).
      doctorId: null,
      lines: [
        { kind: "SERVICE", serviceId: CONSULTATION.id, treatmentId: null, quantity: 1, price: "800" },
        { kind: "SERVICE", serviceId: ROOT_CANAL.id, treatmentId: ROOT_CANAL_TREATMENT, quantity: 1, price: "6000" },
        { kind: "SERVICE", serviceId: CROWN.id, treatmentId: CROWN_TREATMENT, quantity: 1, price: "4000" },
      ],
      discount: { kind: "NONE", amount: "", percent: "" },
      notes: "",
      collect: { on: true, amount: "10800", method: "CASH", reference: "" },
    });
    expect(router.replace).toHaveBeenCalledWith(`/visits/${VISIT}`);
    expect((await screen.findAllByText("Bill 2026-27/0042 issued"))[0]).toBeInTheDocument();
  });

  it("adds a line from the price list, searched and grouped, and removes one", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Remove Crown" }));
    await userEvent.click(screen.getByRole("button", { name: "Add line" }));
    const sheet = screen.getByRole("dialog", { name: "Add a line" });
    expect(within(sheet).getByRole("heading", { name: "Investigation" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Old/ })).not.toBeInTheDocument();
    // The consultation is priced at the doctor's fee here too (D26).
    expect(within(sheet).getByText("₹800")).toBeInTheDocument();
    await userEvent.type(within(sheet).getByRole("searchbox"), "zzz");
    expect(within(sheet).getByText("Nothing in the price list matches.")).toBeInTheDocument();
    await userEvent.clear(within(sheet).getByRole("searchbox"));
    await userEvent.type(within(sheet).getByRole("searchbox"), "x-r");
    await userEvent.click(within(sheet).getByRole("button", { name: /X-ray/ }));
    expect(within(lineOf("X-ray")).getAllByText("₹400")).toHaveLength(2);
    expect(figure("Subtotal")).toHaveTextContent("₹7,200");

    await userEvent.clear(within(lineOf("X-ray")).getByRole("textbox", { name: "Quantity of X-ray" }));
    await userEvent.type(within(lineOf("X-ray")).getByRole("textbox", { name: "Quantity of X-ray" }), "2");
    expect(figure("Subtotal")).toHaveTextContent("₹7,600");
  });

  it("says when the price list is empty", async () => {
    services.current = { data: [] };
    start.current = { data: { ...visitStart, treatments: [] } };
    draw();
    expect(screen.getByText("No lines yet. Add one from the price list.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add line" }));
    expect(screen.getByText("The price list is empty. Add entries in Settings.")).toBeInTheDocument();
    await issue();
    expect(await screen.findByText("Add a line to the bill first.")).toBeInTheDocument();
  });

  it("lets whoever may give discounts change a price, type a line and give a discount, refused past the bill (D29, D293)", async () => {
    auth.current = authStub({ role: "STAFF", permissions: DISCOUNTS });
    start.current = { data: { ...visitStart, treatments: [] } };
    draw();
    const price = within(lineOf("Consultation")).getByRole("textbox", { name: "Price of Consultation" });
    await userEvent.clear(price);
    await userEvent.type(price, "600");
    expect(figure("Subtotal")).toHaveTextContent("₹600");

    await userEvent.click(screen.getByRole("button", { name: "Add line" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add a line" })).getByRole("button", { name: "Add typed line" }),
    );
    const typed = lineOf("Description");
    await userEvent.type(within(typed).getByRole("textbox", { name: /^Description/ }), "Dressing kit");
    await userEvent.type(within(lineOf("Dressing kit")).getByRole("textbox", { name: "Price of Dressing kit" }), "100");
    expect(figure("Subtotal")).toHaveTextContent("₹700");

    await userEvent.click(screen.getByRole("radio", { name: "Amount" }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Discount$/ }), "900");
    expect(figure("Total")).toHaveTextContent("₹0");
    await issue();
    expect(await screen.findByText("A discount can’t be more than the bill.")).toBeInTheDocument();
    expect(client.issue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "Percent" }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Discount \(%\)/ }), "10");
    expect(figure("Discount")).toHaveTextContent("−₹70");
    expect(figure("Total")).toHaveTextContent("₹630");
    await issue();
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect(sent()).toMatchObject({
      lines: [
        { kind: "SERVICE", serviceId: CONSULTATION.id, price: "600" },
        { kind: "TYPED", description: "Dressing kit", quantity: 1, price: "100" },
      ],
      discount: { kind: "PERCENT", percent: "10" },
      collect: { on: true, amount: "630" },
    });
  });

  it("collects the total until an amount is typed, in a method chosen, and shows the balance after (D304)", async () => {
    start.current = { data: { ...visitStart, treatments: [] } };
    draw();
    const amount = screen.getByRole("textbox", { name: /^Amount/ });
    expect(amount).toHaveValue("800");
    expect(figure("Balance after")).toHaveTextContent("₹200 due");
    await userEvent.clear(amount);
    await userEvent.type(amount, "1000");
    expect(figure("Balance after")).toHaveTextContent("Nothing due");
    await userEvent.click(screen.getByRole("radio", { name: "UPI" }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Reference/ }), "UTR 9");
    await userEvent.type(screen.getByRole("textbox", { name: /^Notes/ }), "Paid by her son");
    await issue();
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect(sent()).toMatchObject({
      notes: "Paid by her son",
      collect: { on: true, amount: "1000", method: "UPI", reference: "UTR 9" },
    });
  });

  it("refuses to collect nothing, at the amount, and issues nothing", async () => {
    start.current = { data: { ...visitStart, treatments: [] } };
    draw();
    const amount = screen.getByRole("textbox", { name: /^Amount/ });
    await userEvent.clear(amount);
    await userEvent.type(amount, "0");
    await issue();
    expect(await screen.findByText("Amount must be more than 0.")).toBeInTheDocument();
    expect(client.issue).not.toHaveBeenCalled();
  });

  it("collects nothing once Collect now is off, the balance after counting the whole bill", async () => {
    start.current = { data: { ...visitStart, treatments: [], balancePaise: -30_000 } };
    draw();
    expect(figure("Balance now")).toHaveTextContent("₹300 advance");
    await userEvent.click(screen.getByRole("checkbox", { name: "Collect now" }));
    expect(screen.queryByRole("textbox", { name: /^Amount/ })).not.toBeInTheDocument();
    expect(figure("Balance after")).toHaveTextContent("₹500 due");
    await issue();
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect(sent()).toMatchObject({ collect: { on: false } });
  });

  it("searches for the patient first when it names no one, and keeps where it was started (D313)", async () => {
    params.current = "from=billing";
    start.current = {};
    const found: PatientListItem = {
      id: PATIENT,
      number: 1042,
      name: "Asha Rao",
      phone: "+919876543210",
      dateOfBirth: "1990-01-01",
      gender: "FEMALE",
      lastVisitOn: null,
      balancePaise: 0,
    };
    search.current = { items: [found], nextCursor: null };
    draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/billing");
    await userEvent.type(screen.getByRole("searchbox"), "ash");
    await userEvent.click(screen.getByRole("button", { name: "Asha Rao" }));
    expect(router.replace).toHaveBeenCalledWith(`/billing/new?patient=${PATIENT}&from=billing`);
  });

  it("offers a patient's visit still to bill, and bills them from the price list, leading back to the profile", () => {
    params.current = `patient=${PATIENT}`;
    start.current = {
      data: { ...visitStart, visit: null, doctor: null, treatments: [], toBill: { visitId: VISIT, day: "2026-10-12" } },
    };
    draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", `/patients/${PATIENT}`);
    expect(screen.queryByText(/^Visit /)).not.toBeInTheDocument();
    expect(screen.getByText("Asha Rao has a visit to bill from 12 Oct")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bill that visit" })).toHaveAttribute(
      "href",
      `/billing/new?visit=${VISIT}&from=patient`,
    );
    expect(screen.getByText("No lines yet. Add one from the price list.")).toBeInTheDocument();
  });

  it("leads the visit offered on a profile back to the profile, and keeps Billing when started there (D302)", () => {
    params.current = `visit=${VISIT}&from=patient`;
    start.current = { data: visitStart };
    const first = draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", `/patients/${PATIENT}`);
    first.unmount();

    params.current = `patient=${PATIENT}&from=billing`;
    start.current = { data: { ...visitStart, visit: null, toBill: { visitId: VISIT, day: "2026-10-12" } } };
    draw();
    expect(screen.getByRole("link", { name: "Bill that visit" })).toHaveAttribute(
      "href",
      `/billing/new?visit=${VISIT}&from=billing`,
    );
  });

  it("names a patient's bill's doctor by chips — their assigned one to start — pricing a Consultation by them (D326, D342)", async () => {
    const ARUN = "9a1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a51";
    const MAYA = "9a1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a52";
    params.current = `patient=${PATIENT}`;
    start.current = {
      data: {
        ...visitStart,
        visit: null,
        treatments: [],
        doctor: { id: ARUN, name: "Arun Sen", feePaise: null },
        doctors: [
          { id: ARUN, name: "Arun Sen", feePaise: null },
          { id: MAYA, name: "Maya Rao", feePaise: 80_000 },
          { id: "9a1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a53", name: null, feePaise: null },
        ],
      },
    };
    draw();
    const doctors = screen.getByRole("radiogroup", { name: "Doctor" });
    expect(within(doctors).getByRole("radio", { name: "Arun Sen" })).toBeChecked();
    expect(within(doctors).getByRole("radio", { name: "No doctor" })).toBeInTheDocument();
    expect(within(doctors).getByRole("radio", { name: "No longer on the team" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add line" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add a line" })).getByRole("button", { name: /Consultation/ }),
    );
    // Arun has no fee of his own: the price list's ₹500; Maya's own is ₹800.
    expect(within(lineOf("Consultation")).getAllByText("₹500")).toHaveLength(2);
    await userEvent.click(within(doctors).getByRole("radio", { name: "Maya Rao" }));
    expect(within(lineOf("Consultation")).getAllByText("₹800")).toHaveLength(2);
    // No doctor: the price list's again; then Maya once more.
    await userEvent.click(within(doctors).getByRole("radio", { name: "No doctor" }));
    expect(within(lineOf("Consultation")).getAllByText("₹500")).toHaveLength(2);
    await userEvent.click(within(doctors).getByRole("radio", { name: "Maya Rao" }));
    await issue();
    await waitFor(() => expect(client.issue).toHaveBeenCalled());
    expect(sent()).toMatchObject({ visitId: null, doctorId: MAYA });
  });

  it("issues a patient's bill with no doctor when none is picked, and offers no chips without doctors", async () => {
    params.current = `patient=${PATIENT}`;
    start.current = {
      data: {
        ...visitStart,
        visit: null,
        treatments: [],
        doctor: null,
        doctors: [{ id: "9a1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a52", name: "Maya Rao", feePaise: 80_000 }],
      },
    };
    const first = draw();
    expect(screen.getByRole("radio", { name: "No doctor" })).toBeChecked();
    first.unmount();
    start.current = { data: { ...visitStart, visit: null, treatments: [], doctor: null, doctors: [] } };
    draw();
    expect(screen.queryByRole("radiogroup", { name: "Doctor" })).not.toBeInTheDocument();
  });

  it("names an arrival's token, and a doctor gone as no doctor", () => {
    params.current = `appointment=${VISIT}`;
    start.current = {
      data: { ...visitStart, visit: null, appointment: { id: VISIT, status: "ARRIVED", token: 7 }, doctor: null },
    };
    draw();
    expect(screen.getByText("Arrival · #7 with No doctor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/queue");
  });

  it("names an appointment with no token yet by its doctor alone", () => {
    params.current = `appointment=${VISIT}`;
    start.current = { data: { ...visitStart, visit: null, appointment: { id: VISIT, status: "BOOKED", token: null } } };
    draw();
    expect(screen.getByText("Arrival with Maya Rao")).toBeInTheDocument();
  });

  it("bills nothing for an archived patient, and says why", () => {
    start.current = { data: { ...visitStart, patient: { ...visitStart.patient, archived: true } } };
    draw();
    expect(screen.getByText("Asha Rao is archived, so nothing can be billed. Restore them first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue bill" })).not.toBeInTheDocument();
  });

  it("turns Issue off in a view-only clinic, and says why", () => {
    const stub = authStub({ role: "STAFF", permissions: DESK });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.getByRole("button", { name: "Issue bill" })).toBeDisabled();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
  });

  it("says when where it starts, or the price list, could not be read — with Try again", async () => {
    const mutate = vi.fn();
    start.current = { error: new Error("down"), mutate, isValidating: false };
    const first = draw();
    expect(screen.getByText("What to bill couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
    first.unmount();

    start.current = {};
    services.current = { error: new Error("down"), mutate, isValidating: false };
    const second = draw();
    expect(screen.getByText("The price list couldn't be loaded.")).toBeInTheDocument();
    second.unmount();

    services.current = {};
    draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
  });
});

describe("NewBill, issuing a void bill again (D314)", () => {
  const BILL = "9d3a6c74-5e7f-4081-8cbd-2e3f4a5b6c7d";
  const voided = {
    id: BILL,
    lines: [
      {
        description: "Root canal",
        quantity: 1,
        unitPricePaise: 600_000,
        amountPaise: 600_000,
        serviceId: ROOT_CANAL.id,
        treatmentId: ROOT_CANAL_TREATMENT,
      },
    ],
    discountPaise: 50_000,
    notes: "Second sitting",
  } as BillDetail;

  it("fills the bill with the void one's lines, discount and notes, in place of the visit's own", () => {
    params.current = `visit=${VISIT}&reissue=${BILL}`;
    reissued.current = { data: voided };
    draw();
    expect(reissued.asked).toContain(BILL);
    expect(lineOf("Root canal")).toHaveTextContent("For Root canal");
    expect(screen.queryByRole("group", { name: "Consultation" })).not.toBeInTheDocument();
    expect(figure("Total")).toHaveTextContent("₹5,500");
    expect(screen.getByRole("textbox", { name: /^Notes/ })).toHaveValue("Second sitting");
  });

  it("waits for the void bill, and says when it could not be read", () => {
    params.current = `visit=${VISIT}&reissue=${BILL}`;
    const first = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    first.unmount();

    reissued.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    draw();
    expect(screen.getByText("This bill couldn't be loaded.")).toBeInTheDocument();
  });

  it("asks for no bill to issue again without one named, or with no one billed", () => {
    draw();
    expect(reissued.asked.every((asked) => asked === null)).toBe(true);
    params.current = `reissue=${BILL}`;
    draw();
    expect(reissued.asked.at(-1)).toBeNull();
  });
});
