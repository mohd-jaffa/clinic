import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientPrefill } from "@/features/patients/components/PatientSheet";
import type { PatientListItem } from "@/features/patients/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, adding, list, sheet } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
  list: {
    current: { data: [] as PatientListItem[] | undefined, isLoading: false, error: undefined as unknown },
    asked: vi.fn(),
  },
  sheet: { prefill: undefined as PatientPrefill | undefined },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
// What is typed is searched as it is, so a test need not wait for it to settle.
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/features/patients/hooks/usePatients", () => ({
  usePatients: (search: string, tab: string) => {
    list.asked(search, tab);
    return list.current;
  },
}));
vi.mock("@/features/patients/components/PatientSheet", () => ({
  PatientSheet: ({ open, prefill }: { open: boolean; prefill?: PatientPrefill }) => {
    sheet.prefill = prefill;
    return open ? <div role="dialog" aria-label="Add a patient" /> : null;
  },
}));

const { Patients } = await import("@/features/patients/components/Patients");

const ROHAN: PatientListItem = {
  id: "p-1",
  number: 1012,
  name: "Rohan Mehta",
  phone: "+919876543210",
  dateOfBirth: "1990-04-12",
  gender: "MALE",
};

const draw = () =>
  render(
    <Providers>
      <Patients />
    </Providers>,
  );

const search = () => screen.getByRole("searchbox");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
  list.current = { data: [ROHAN], isLoading: false, error: undefined };
  sheet.prefill = undefined;
});
afterEach(() => vi.useRealTimers());

describe("Patients (plan §10.2, D104, D121)", () => {
  it("lists the clinic's patients — age, gender, number and mobile — each opening their profile", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Patients" })).toBeInTheDocument();
    expect(list.asked).toHaveBeenLastCalledWith("", "ALL");
    const row = within(screen.getByRole("list", { name: "Patients" })).getByRole("listitem");
    const open = within(row).getByRole("link", { name: /^Rohan Mehta/ });
    expect(open).toHaveAttribute("href", "/patients/p-1");
    expect(row).toHaveTextContent("36 y · Male · P-1012 · 98765 43210");
    // Call is on the profile, a tap away, not on every row.
    expect(within(row).getAllByRole("link")).toHaveLength(1);
  });

  it("searches what is typed, trimmed", async () => {
    draw();
    await userEvent.type(search(), " Meh ");
    expect(list.asked).toHaveBeenLastCalledWith("Meh", "ALL");
  });

  it("says when the clinic has no patients yet, under the one Add patient", () => {
    list.current = { ...list.current, data: [] };
    draw();
    expect(screen.getByRole("heading", { name: "No patients yet" })).toBeInTheDocument();
    expect(screen.getByText("Patients you add appear here, the newest first.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add patient" })).toHaveLength(1);
  });

  it("shows a doctor their own patients, and says so", () => {
    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view"] });
    list.current = { ...list.current, data: [] };
    draw();
    expect(screen.getByText("Your patients")).toBeInTheDocument();
    expect(screen.getByText("Patients assigned to you, or booked with you, appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
  });

  it("says the patients couldn't be loaded", () => {
    list.current = { data: undefined, isLoading: false, error: new TypeError("Failed to fetch") };
    draw();
    expect(screen.getByRole("alert")).toHaveTextContent("The patients couldn't be loaded.");
  });
});

describe("Patients when a search finds no one (D112)", () => {
  beforeEach(() => {
    list.current = { ...list.current, data: [] };
  });

  it("offers to add them with the mobile typed", async () => {
    draw();
    await userEvent.type(search(), "98765 43210");
    expect(screen.getByText("No patient matches “98765 43210”")).toBeInTheDocument();
    expect(screen.getByText("Add them now — what you typed is filled in.")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Add patient" })[1]);
    expect(adding.current.show).toHaveBeenCalledOnce();
    expect(sheet.prefill).toEqual({ phone: "98765 43210" });
  });

  it("offers to add them with the name typed, and with nothing from a patient's number", async () => {
    draw();
    await userEvent.type(search(), "Kabir");
    await userEvent.click(screen.getAllByRole("button", { name: "Add patient" })[1]);
    expect(sheet.prefill).toEqual({ fullName: "Kabir" });

    await userEvent.clear(search());
    await userEvent.type(search(), "P-1012");
    await userEvent.click(screen.getAllByRole("button", { name: "Add patient" })[1]);
    expect(sheet.prefill).toEqual({});
  });

  it("only says so to someone who may not add", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    draw();
    await userEvent.type(search(), "Kabir");
    expect(screen.getByText("No patient matches “Kabir”")).toBeInTheDocument();
    expect(screen.queryByText("Add them now — what you typed is filled in.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
  });
});

describe("Patients' archived tab (plan §10.2)", () => {
  it("lists the archived on their own tab, for those who may restore them", async () => {
    draw();
    await userEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(list.asked).toHaveBeenLastCalledWith("", "ARCHIVED");
    expect(screen.getByRole("tab", { name: "Archived" })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("tabpanel")).getByRole("link", { name: /^Rohan Mehta/ })).toBeInTheDocument();
  });

  it("says when none are archived, and offers no add from a search there", async () => {
    list.current = { ...list.current, data: [] };
    draw();
    await userEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(screen.getByRole("heading", { name: "No archived patients" })).toBeInTheDocument();
    await userEvent.type(search(), "Kabir");
    expect(screen.getByText("No patient matches “Kabir”")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add patient" })).toHaveLength(1);
  });

  it("has no tabs for someone who may only see patients", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    draw();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Rohan Mehta/ })).toBeInTheDocument();
  });
});

describe("Patients' Add patient (D67)", () => {
  it("opens the add form from its button", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Add patient" }));
    expect(adding.current.show).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the add form while the address names it, as the ＋ does", () => {
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.getByRole("dialog", { name: "Add a patient" })).toBeInTheDocument();
    expect(sheet.prefill).toEqual({});
  });

  it("offers no add to someone who may only see patients", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds nothing in a view-only clinic, and says why", async () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    adding.current = { ...adding.current, open: true };
    list.current = { ...list.current, data: [] };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.type(search(), "Kabir");
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
  });

  it("offers nothing to someone with no clinic", () => {
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
