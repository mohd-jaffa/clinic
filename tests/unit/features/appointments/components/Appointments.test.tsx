import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, adding } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
vi.mock("@/features/appointments/components/BookingSheet", () => ({
  BookingSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Book an appointment" /> : null),
}));

const { Appointments } = await import("@/features/appointments/components/Appointments");

const draw = () =>
  render(
    <Providers>
      <Appointments />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
});

describe("Appointments (plan §11.5, D67)", () => {
  it("offers Book appointment to whoever may book, which opens the sheet — as the ＋'s Appointment does", async () => {
    const { rerender } = draw();
    expect(screen.getByRole("heading", { level: 1, name: "Appointments" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(adding.current.show).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    adding.current = { ...adding.current, open: true };
    rerender(
      <Providers>
        <Appointments />
      </Providers>,
    );
    expect(screen.getByRole("dialog", { name: "Book an appointment" })).toBeInTheDocument();
  });

  it("offers nothing to book to a member who may not", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.queryByRole("button", { name: "Book appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("books nothing in a view-only clinic, and says why", () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.queryByRole("button", { name: "Book appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });
});
