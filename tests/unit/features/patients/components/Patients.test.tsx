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
vi.mock("@/features/patients/components/PatientSheet", () => ({
  PatientSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Add a patient" /> : null),
}));

const { Patients } = await import("@/features/patients/components/Patients");

const draw = () =>
  render(
    <Providers>
      <Patients />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
});

describe("Patients (plan §10.2, D67)", () => {
  it("is the place for patients, with Add patient for those who may", async () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Patients" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add patient" }));
    expect(adding.current.show).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the add form while the address names it, as the ＋ does", () => {
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.getByRole("dialog", { name: "Add a patient" })).toBeInTheDocument();
  });

  it("offers no add to someone who may only see patients", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds nothing in a view-only clinic, and says why", () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    adding.current = { ...adding.current, open: true };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers nothing to someone with no clinic", () => {
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: "Add patient" })).not.toBeInTheDocument();
  });
});
