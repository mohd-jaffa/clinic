import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, router, outcome } = vi.hoisted(() => ({
  client: { start: vi.fn(), done: vi.fn() },
  router: { push: vi.fn() },
  outcome: { current: undefined as boolean | undefined },
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { useFinishVisit, useStartVisit } = await import("@/features/visits/hooks/useVisitMoves");

function Start() {
  const { start, starting } = useStartVisit({ name: "Asha Iyer" }, (doctorId) => `Doctor ${doctorId}`);
  return (
    <button
      type="button"
      aria-busy={starting}
      onClick={async () => {
        outcome.current = await start({ patientId: "p-1", doctorId: "d-1" });
      }}
    >
      Start
    </button>
  );
}

function Finish() {
  const { finish } = useFinishVisit({ id: "v-1", patient: { name: "Asha Iyer" } });
  return (
    <button type="button" onClick={() => void finish()}>
      Finish
    </button>
  );
}

/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];
const card = (name: string) => screen.findByRole("alertdialog", { name });

beforeEach(() => {
  vi.clearAllMocks();
  outcome.current = undefined;
});

describe("useStartVisit (D204)", () => {
  it("starts the visit, says so, and opens it, leading back to the profile (D230)", async () => {
    client.start.mockResolvedValue({ visitId: "v-9", created: true });
    render(<Start />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.start).toHaveBeenCalledWith({ patientId: "p-1", doctorId: "d-1" });
    expect(await notice("Asha Iyer’s visit started")).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/visits/v-9?from=patient");
    expect(outcome.current).toBe(true);
  });

  it("opens the visit already open with that doctor, naming them", async () => {
    client.start.mockResolvedValue({ visitId: "v-3", created: false });
    render(<Start />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await notice("Asha Iyer is already in with Doctor d-1")).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/visits/v-3?from=patient");
  });

  it("says why it was not started, and opens nothing", async () => {
    client.start.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "Archived."));
    render(<Start />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await card("The visit wasn’t started")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(outcome.current).toBe(false);
  });
});

describe("useFinishVisit (D204)", () => {
  it("closes the visit and says so", async () => {
    client.done.mockResolvedValue({ visitId: "v-1" });
    render(<Finish />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(client.done).toHaveBeenCalledWith("v-1");
    expect(await notice("Asha Iyer’s visit is done")).toBeInTheDocument();
  });

  it("says why it was not", async () => {
    client.done.mockRejectedValue(new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "No."));
    render(<Finish />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await card("That wasn’t marked done")).toBeInTheDocument();
  });
});
