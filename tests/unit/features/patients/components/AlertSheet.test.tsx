import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAlert } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const client = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn() }));
vi.mock("@/features/patients/api.client", () => ({ AlertsClient: client }));

const { AlertSheet } = await import("@/features/patients/components/AlertSheet");

const onClose = vi.fn();
const PENICILLIN: PatientAlert = { id: "a-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true };

function Harness({ alert }: { alert?: PatientAlert }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <AlertSheet open={open} onClose={close} patientId="p-1" alert={alert} />;
}

const draw = (alert?: PatientAlert) =>
  render(
    <Providers>
      <Harness alert={alert} />
    </Providers>,
  );

const sheet = (name = "Add an alert") => screen.getByRole("dialog", { name });
const field = (name: RegExp, within_ = sheet()) => within(within_).getByRole("textbox", { name });

beforeEach(() => {
  vi.clearAllMocks();
  client.add.mockImplementation(async ({ label }: { label: string }) => ({ ...PENICILLIN, id: "a-2", label }));
  client.update.mockImplementation(async ({ label }: { label: string }) => ({ ...PENICILLIN, label }));
});

describe("AlertSheet adding an alert (plan §10.4)", () => {
  it("asks for a name, then adds an allergy by default and says so", async () => {
    draw();
    expect(within(sheet()).getByRole("radio", { name: "Allergy" })).toBeChecked();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add alert" }));
    expect(await screen.findByText("Name needs a value.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();

    await userEvent.type(field(/^Name/), " Peanuts ");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add alert" }));
    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({ patientId: "p-1", kind: "ALLERGY", label: "Peanuts", note: "" }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain("Peanuts added");
  });

  it("adds a condition or a medication, with its note", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Medication" }));
    await userEvent.type(field(/^Name/), "Metformin 500 mg");
    await userEvent.type(field(/^Note/), "Twice a day");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add alert" }));
    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({
        patientId: "p-1",
        kind: "MEDICATION",
        label: "Metformin 500 mg",
        note: "Twice a day",
      }),
    );
  });

  it("says a refusal, and keeps what was typed", async () => {
    client.add.mockRejectedValueOnce(
      new ApiError(409, "ALERT_ALREADY_EXISTS", "This patient already has that alert.", "req_1"),
    );
    draw();
    await userEvent.type(field(/^Name/), "Penicillin");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add alert" }));
    expect(await screen.findByText("The alert wasn’t added")).toBeInTheDocument();
    expect(field(/^Name/)).toHaveValue("Penicillin");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AlertSheet changing an alert (D119)", () => {
  it("opens on it, its kind fixed, and saves its name and note", async () => {
    draw({ ...PENICILLIN, note: "Rash" });
    const edit = sheet("Edit allergy");
    expect(within(edit).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(field(/^Name/, edit)).toHaveValue("Penicillin");
    expect(field(/^Note/, edit)).toHaveValue("Rash");
    await userEvent.clear(field(/^Name/, edit));
    await userEvent.type(field(/^Name/, edit), "Amoxicillin");
    await userEvent.click(within(edit).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.update).toHaveBeenCalledWith({
        patientId: "p-1",
        alertId: "a-1",
        label: "Amoxicillin",
        note: "Rash",
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain("Amoxicillin saved");
  });

  it("clears a note, and says a refusal", async () => {
    client.update.mockRejectedValueOnce(
      new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived. Restore them to make changes.", "req_2"),
    );
    draw(PENICILLIN);
    await userEvent.click(within(sheet("Edit allergy")).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That wasn’t saved")).toBeInTheDocument();
    expect(client.update).toHaveBeenCalledWith({ patientId: "p-1", alertId: "a-1", label: "Penicillin", note: "" });
  });
});
