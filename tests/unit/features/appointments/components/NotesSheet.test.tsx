import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { anAppointmentDetail } from "@tests/support/appointments";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { change: vi.fn() } }));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));

const { NotesSheet } = await import("@/features/appointments/components/NotesSheet");

const onClose = vi.fn();
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.change.mockResolvedValue({ id: "a-1", status: "ARRIVED" });
});

const draw = (notes: string | null) =>
  render(
    <Providers>
      <NotesSheet appointment={anAppointmentDetail({ notes })} open onClose={onClose} onDone={onDone} />
    </Providers>,
  );
const sheet = () => screen.getByRole("dialog", { name: "Edit notes" });
const notes = () => within(sheet()).getByRole("textbox", { name: /^Notes/ });

describe("NotesSheet (D161)", () => {
  it("starts on its notes, and saves what was typed — closing everything with a card", async () => {
    draw("First visit");
    expect(notes()).toHaveValue("First visit");
    await userEvent.clear(notes());
    await userEvent.type(notes(), "Bring reports");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    expect(client.change).toHaveBeenCalledWith({ id: "a-1", input: { notes: "Bring reports" } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await screen.findAllByText("Notes saved for Rohan Mehta")).length).toBeGreaterThan(0);
  });

  it("starts empty with none, and says why a save was refused, staying open", async () => {
    client.change.mockRejectedValue(new ApiError(403, "AUTH_PERMISSION_DENIED", "Not allowed.", "req_1"));
    draw(null);
    expect(notes()).toHaveValue("");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That wasn’t changed")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
