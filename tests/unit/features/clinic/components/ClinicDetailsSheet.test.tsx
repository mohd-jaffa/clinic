import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { aClinicProfile } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { update: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ClinicClient: client }));

const { ClinicDetailsSheet } = await import("@/features/clinic/components/ClinicDetailsSheet");

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  client.update.mockResolvedValue(aClinicProfile({ name: "Smile Care Dental Clinic" }));
});

/** The sheet open, as Clinic details opens it: closing it closes it. */
function Opened({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ClinicDetailsSheet
      open={open}
      profile={aClinicProfile({ phone: "0484 234 5678" })}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

const field = (name: RegExp) => screen.getByRole("textbox", { name, hidden: true });

describe("ClinicDetailsSheet (plan §9, D78)", () => {
  it("holds the clinic's details as they are, and saves them together", async () => {
    const onClose = vi.fn();
    render(
      <Providers>
        <Opened onClose={onClose} />
      </Providers>,
    );

    const sheet = screen.getByRole("dialog", { name: "Change clinic details" });
    expect(sheet).toBeInTheDocument();
    expect(field(/^Clinic name/)).toHaveValue("Smile Care Dental");
    expect(field(/^Clinic phone/)).toHaveValue("0484 234 5678");
    expect(screen.getByRole("combobox", { name: /^Clinic type/ })).toHaveTextContent("Dental");

    await userEvent.clear(field(/^Clinic name/));
    await userEvent.type(field(/^Clinic name/), "Smile Care Dental Clinic");
    await userEvent.type(field(/^GSTIN/), "32abcde1234f1z5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.update).toHaveBeenCalledWith({
      details: expect.objectContaining({ name: "Smile Care Dental Clinic", gstin: "32abcde1234f1z5", email: "" }),
    });
    expect(auth.current.reload).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Clinic details saved"));
  });

  it("says beside a field what is wrong with it, and sends nothing", async () => {
    render(
      <Providers>
        <Opened />
      </Providers>,
    );
    await userEvent.type(field(/^GSTIN/), "32");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("GSTIN must be 15 characters, like 32ABCDE1234F1Z5.")).toBeInTheDocument();
    expect(client.update).not.toHaveBeenCalled();
  });

  it("keeps what was typed when the save fails, and says why", async () => {
    client.update.mockRejectedValue(
      new ApiError(422, "CLINIC_PLAN_EXPIRED", "Your clinic is view-only until its plan is renewed."),
    );
    render(
      <Providers>
        <Opened />
      </Providers>,
    );
    await userEvent.type(field(/^City/), " East");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const card = await screen.findByRole("alertdialog", { name: "The clinic details weren’t changed" });
    expect(card).toHaveTextContent("Your clinic is view-only until its plan is renewed.");
    expect(field(/^City/)).toHaveValue("Kochi East");
  });
});
