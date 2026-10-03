import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { anAppointmentType } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), change: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ AppointmentTypesClient: client }));
vi.mock("@/features/clinic/hooks/useAppointmentTypes", () => ({ useAppointmentTypes: () => query.current }));

const { AppointmentTypes } = await import("@/features/clinic/components/AppointmentTypes");

const types = [
  anAppointmentType(),
  anAppointmentType({ id: "a-2", name: "Follow-up", minutes: 10 }),
  anAppointmentType({ id: "a-4", name: "Review", active: false }),
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: types, isLoading: false };
  client.change.mockImplementation(async ({ id, active }: { id: string; active: boolean }) => ({
    ...types.find((type) => type.id === id)!,
    active,
  }));
});

const draw = () =>
  render(
    <Providers>
      <AppointmentTypes />
    </Providers>,
  );

describe("AppointmentTypes (plan §9, D32, D81)", () => {
  it("names itself and how many kinds of visit there are, each with its usual length", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Appointment types" })).toBeInTheDocument();
    expect(screen.getByText("2 kinds of visit")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Appointment types" }))
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["Consultation15 min", "Follow-up10 min"]);
  });

  it("opens a type's sheet to change it, and an empty one to add one", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Follow-up" }));
    const sheet = screen.getByRole("dialog", { name: "Change appointment type" });
    expect(within(sheet).getByRole("textbox", { name: /^Length in minutes/ })).toHaveValue("10");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Add appointment type" }));
    expect(screen.getByRole("dialog", { name: "Add an appointment type" })).toBeInTheDocument();
  });

  it("restores an archived type (D80)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    await userEvent.click(screen.getByRole("button", { name: "Restore Review" }));
    expect(client.change).toHaveBeenCalledWith({ id: "a-4", active: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Review restored"));
  });

  it("says why when it cannot load", () => {
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The appointment types couldn't be loaded.")).toBeInTheDocument();
  });
});
