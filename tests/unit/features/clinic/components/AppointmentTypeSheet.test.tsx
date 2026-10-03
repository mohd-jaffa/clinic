import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentType } from "@/features/clinic/types";
import { ApiError } from "@/lib/api/client";
import { anAppointmentType } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() } }));
vi.mock("@/features/clinic/api.client", () => ({ AppointmentTypesClient: client }));

const { AppointmentTypeSheet } = await import("@/features/clinic/components/AppointmentTypeSheet");

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.add.mockImplementation(async ({ name }: { name: string }) => anAppointmentType({ id: "a-6", name }));
  client.change.mockImplementation(
    async ({ id, details, active }: { id: string; details?: object; active?: boolean }) =>
      anAppointmentType({ id, ...details, ...(active !== undefined && { active }) }),
  );
});

/** The sheet as a screen holds it: open until it closes itself. */
function Harness({ type }: { type: AppointmentType | null }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <AppointmentTypeSheet open={open} onClose={close} type={type} />;
}

const draw = (type: AppointmentType | null) =>
  render(
    <Providers>
      <Harness type={type} />
    </Providers>,
  );

const field = (name: RegExp) => within(screen.getByRole("dialog")).getByRole("textbox", { name });

describe("AppointmentTypeSheet (plan §9, D32)", () => {
  it("adds a type: its name and its usual length", async () => {
    draw(null);
    const sheet = screen.getByRole("dialog", { name: "Add an appointment type" });
    expect(within(sheet).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await userEvent.type(field(/^Name/), "Root canal");
    await userEvent.type(field(/^Length in minutes/), "45");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.add).toHaveBeenCalledWith({ name: "Root canal", minutes: "45" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Root canal added");
  });

  it("holds the length to 5 – 480 whole minutes, beside the field", async () => {
    draw(null);
    await userEvent.type(field(/^Name/), "Quick look");
    await userEvent.type(field(/^Length in minutes/), "4");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Length in minutes must be from 5 to 480.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("changes a type, starting from what it is, and says when it could not", async () => {
    draw(anAppointmentType());
    expect(field(/^Length in minutes/)).toHaveValue("15");
    await userEvent.clear(field(/^Length in minutes/));
    await userEvent.type(field(/^Length in minutes/), "20");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.change).toHaveBeenCalledWith({ id: "a-1", details: { name: "Consultation", minutes: "20" } }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Consultation saved");
  });

  it("says when another type has the name", async () => {
    client.add.mockRejectedValue(
      new ApiError(409, "APPOINTMENT_TYPE_ALREADY_EXISTS", "Another appointment type already has this name."),
    );
    draw(null);
    await userEvent.type(field(/^Name/), "Review");
    await userEvent.type(field(/^Length in minutes/), "15");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "The appointment type wasn’t saved" })).toHaveTextContent(
      "Another appointment type already has this name.",
    );
  });

  it("archives the type once asked, then closes (D80)", async () => {
    draw(anAppointmentType());
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const ask = screen.getByRole("alertdialog", { name: "Archive Consultation?" });
    expect(ask).toHaveTextContent("New bookings won’t offer it.");
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.change).toHaveBeenCalledWith({ id: "a-1", active: false });
  });
});
