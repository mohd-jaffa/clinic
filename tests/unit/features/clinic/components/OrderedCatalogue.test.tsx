import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession, authStub } from "@tests/support/auth";
import { anAppointmentType } from "@tests/support/clinic";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { OrderedCatalogue } = await import("@/features/clinic/components/OrderedCatalogue");

const types = [
  anAppointmentType(),
  anAppointmentType({ id: "a-2", name: "Follow-up", minutes: 10 }),
  anAppointmentType({ id: "a-4", name: "Review", active: false }),
];
const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onRestore: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
});

const draw = () =>
  render(
    <OrderedCatalogue
      entries={types}
      label="Appointment types"
      detail={(type) => `${type.minutes} min`}
      addLabel="Add appointment type"
      orderNote="New types join the end of the list."
      restoring={null}
      {...handlers}
    />,
  );

describe("OrderedCatalogue (D80, D81)", () => {
  it("lists the active ones in order, each with its value, each opening its sheet", async () => {
    draw();
    const list = screen.getByRole("list", { name: "Appointment types" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["Consultation15 min", "Follow-up10 min"]);
    await userEvent.click(within(list).getByRole("button", { name: "Follow-up" }));
    expect(handlers.onEdit).toHaveBeenCalledWith(types[1]);
  });

  it("adds at the foot, saying where a new one goes", async () => {
    draw();
    expect(screen.getByText("New types join the end of the list.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add appointment type" }));
    expect(handlers.onAdd).toHaveBeenCalled();
  });

  it("keeps the archived ones under it, to be restored", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.getByRole("list", { name: "Archived" })).toHaveTextContent("Review15 min");
    await userEvent.click(screen.getByRole("button", { name: "Restore Review" }));
    expect(handlers.onRestore).toHaveBeenCalledWith(types[2]);
  });

  it("in a view-only clinic, shows them all and changes none, saying why", async () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw();
    const list = screen.getByRole("list", { name: "Appointment types" });
    expect(within(list).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add appointment type" })).not.toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.queryByRole("button", { name: "Restore Review" })).not.toBeInTheDocument();
  });
});
