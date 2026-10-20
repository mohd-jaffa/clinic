import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientListItem } from "@/features/patients/types";

const { search } = vi.hoisted(() => ({ search: { current: undefined as unknown, asked: vi.fn() } }));
vi.mock("@/features/patients/hooks/usePatientSearch", () => ({
  usePatientSearch: (typed: string) => {
    search.asked(typed);
    return { data: search.current };
  },
}));

const { PatientPicker } = await import("@/features/appointments/components/PatientPicker");

const patient = (n: number, name: string): PatientListItem => ({
  id: `p-${n}`,
  number: 1000 + n,
  name,
  phone: "+919876543210",
  dateOfBirth: "1990-04-12",
  gender: "MALE",
  lastVisitOn: null,
  balancePaise: 0,
});
const ROHAN = patient(12, "Rohan Mehta");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T08:30:00Z"));
  search.current = undefined;
});
afterEach(() => vi.useRealTimers());

const props = () => ({ chosen: null, onChoose: vi.fn(), onClear: vi.fn(), onNew: vi.fn() });

describe("PatientPicker (D144)", () => {
  it("searches as it is typed and lists the best matches, each to choose", async () => {
    search.current = { items: [ROHAN, patient(77, "Rohan Das")], nextCursor: null };
    const handlers = props();
    render(<PatientPicker {...handlers} />);
    expect(screen.getByRole("group", { name: /^Patient/ })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search by name, mobile or number" }), "roh");
    expect(search.asked).toHaveBeenLastCalledWith("roh");
    const found = screen.getByRole("list", { name: "Patient" });
    expect(within(found).getByText("36 y · Male · P-1012")).toBeInTheDocument();
    await userEvent.click(within(found).getByRole("button", { name: "Rohan Mehta" }));
    expect(handlers.onChoose).toHaveBeenCalledWith(ROHAN);
  });

  it("lists at most PICKER_RESULTS, and says when no one is found", async () => {
    search.current = { items: Array.from({ length: 9 }, (_, n) => patient(n, `Patient ${n}`)), nextCursor: "20" };
    const { rerender } = render(<PatientPicker {...props()} />);
    await userEvent.type(screen.getByRole("searchbox"), "pat");
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(6);

    search.current = { items: [], nextCursor: null };
    rerender(<PatientPicker {...props()} />);
    expect(screen.getByRole("status")).toHaveTextContent("No patient found. Add them as a new patient.");
  });

  it("starts a new patient from what was typed (D112), for whoever may add one", async () => {
    const handlers = props();
    const { rerender } = render(<PatientPicker {...handlers} />);
    await userEvent.type(screen.getByRole("searchbox"), "Meera Pillai");
    await userEvent.click(screen.getByRole("button", { name: "New patient" }));
    expect(handlers.onNew).toHaveBeenCalledWith({ fullName: "Meera Pillai" });

    rerender(<PatientPicker {...handlers} onNew={undefined} />);
    expect(screen.queryByRole("button", { name: "New patient" })).not.toBeInTheDocument();
  });

  it("shows the one chosen with Change, and asks for one while none is, in words", async () => {
    const handlers = props();
    const { rerender } = render(<PatientPicker {...handlers} chosen={ROHAN} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(search.asked).toHaveBeenLastCalledWith("");
    await userEvent.click(screen.getByRole("button", { name: "Change Rohan Mehta" }));
    expect(handlers.onClear).toHaveBeenCalled();

    rerender(<PatientPicker {...handlers} error="Choose patient." />);
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Choose patient.");
    expect(screen.getByRole("group", { name: /^Patient/ })).toHaveAttribute("aria-describedby", error.id);
  });
});
