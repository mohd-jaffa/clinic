import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aClosure } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { client, doctors } = vi.hoisted(() => ({
  client: { add: vi.fn() },
  doctors: { current: {} as { data?: { id: string; name: string }[] } },
}));
vi.mock("@/features/clinic/api.client", () => ({ ClosuresClient: client }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => doctors.current }));
// The appointments already on the days are their own component's to list (D137): here, only what it is handed.
vi.mock("@/features/clinic/components/ClosureAppointments", () => ({
  ClosureAppointments: ({ who, startsOn, endsOn }: { who: string; startsOn: string; endsOn: string }) => (
    <p>{`Appointments for ${who} ${startsOn} – ${endsOn}`}</p>
  ),
}));

const { ClosureSheet } = await import("@/features/clinic/components/ClosureSheet");

const RAHUL = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Today, in Kochi: Saturday 3 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  doctors.current = { data: [{ id: RAHUL, name: "Rahul Nair" }] };
  client.add.mockImplementation(async ({ reason }: { reason: string }) => aClosure({ id: "h-9", reason }));
});
afterEach(() => vi.useRealTimers());

/** The sheet as a screen holds it: open until it closes itself. */
function Harness() {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <ClosureSheet open={open} onClose={close} />;
}

const draw = () =>
  render(
    <Providers>
      <Harness />
    </Providers>,
  );

const sheet = () => screen.getByRole("dialog", { name: "Add a holiday or leave" });
const pick = async (field: RegExp, day: string) => {
  await userEvent.click(within(sheet()).getByRole("button", { name: field }));
  await userEvent.click(screen.getByRole("button", { name: day }));
};
const dayOf = (field: RegExp) => within(sheet()).getByRole("button", { name: field });

describe("ClosureSheet (plan §9, D85)", () => {
  it("adds a whole-clinic holiday, the last day filled in from the first", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("First day needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Last day needs a value.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Who’s away/ })).toHaveTextContent("Whole clinic");

    await pick(/^First day/, "Tuesday, 20 Oct 2026");
    expect(dayOf(/^Last day/)).toHaveTextContent("20 Oct 2026");
    await waitFor(() => expect(screen.queryByText("Last day needs a value.")).not.toBeInTheDocument());
    await pick(/^Last day/, "Thursday, 22 Oct 2026");
    expect(within(sheet()).getByText("Appointments for CLINIC 2026-10-20 – 2026-10-22")).toBeInTheDocument();
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reason/ }), "Diwali");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({
        who: "CLINIC",
        startsOn: "2026-10-20",
        endsOn: "2026-10-22",
        reason: "Diwali",
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Diwali added");
  });

  it("offers no day before today, and moves the last day only when the first passes it", async () => {
    draw();
    await userEvent.click(dayOf(/^First day/));
    expect(screen.getByRole("button", { name: "Friday, 2 Oct 2026" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Tuesday, 20 Oct 2026" }));
    await pick(/^Last day/, "Saturday, 24 Oct 2026");
    await pick(/^First day/, "Wednesday, 21 Oct 2026");
    expect(dayOf(/^Last day/)).toHaveTextContent("24 Oct 2026");
    await pick(/^First day/, "Monday, 26 Oct 2026");
    expect(dayOf(/^Last day/)).toHaveTextContent("26 Oct 2026");
  });

  it("adds a doctor's leave", async () => {
    draw();
    await userEvent.click(screen.getByRole("combobox", { name: /^Who’s away/ }));
    await userEvent.click(screen.getByRole("option", { name: "Rahul Nair" }));
    await pick(/^First day/, "Saturday, 31 Oct 2026");
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reason/ }), "Conference");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({
        who: RAHUL,
        startsOn: "2026-10-31",
        endsOn: "2026-10-31",
        reason: "Conference",
      }),
    );
  });

  it("offers the whole clinic alone while there are no doctors to name", async () => {
    doctors.current = {};
    draw();
    await userEvent.click(screen.getByRole("combobox", { name: /^Who’s away/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Whole clinic"]);
  });

  it("says why it could not, and keeps what was typed", async () => {
    client.add.mockRejectedValue(
      new ApiError(409, "CLOSURE_DAYS_TAKEN", "Those days overlap a holiday or leave already set for the same people."),
    );
    draw();
    await pick(/^First day/, "Tuesday, 20 Oct 2026");
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reason/ }), "Puja");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toHaveTextContent(
      "Those days overlap",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(within(sheet()).getByRole("textbox", { name: /^Reason/ })).toHaveValue("Puja");
  });
});
