import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_PRESET_SETS, PERMISSIONS, type Permission } from "@/constants/permissions";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aTeamMember } from "@tests/support/team";

const { client } = vi.hoisted(() => ({ client: { invite: vi.fn() } }));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));

const { InviteSheet } = await import("@/features/team/components/InviteSheet");

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.invite.mockImplementation(async ({ email }: { email: string }) => ({
    member: aTeamMember({ email, status: "INVITED" }),
    emailSent: true,
  }));
});

/** The sheet as the Team screen holds it: open until it closes itself. */
function Harness({ allowed }: { allowed: readonly Permission[] }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <InviteSheet open={open} onClose={close} allowed={allowed} />;
}

const draw = (allowed: readonly Permission[] = PERMISSIONS) =>
  render(
    <Providers>
      <Harness allowed={allowed} />
    </Providers>,
  );

const sheet = () => screen.getByRole("dialog", { name: "Invite a team member" });
const field = (name: RegExp) => within(sheet()).getByRole("textbox", { name });
const role = (name: string) => within(screen.getByRole("radiogroup", { name: "Role" })).getByRole("radio", { name });
const preset = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Start from" })).getByRole("radio", { name });
const send = () => userEvent.click(within(sheet()).getByRole("button", { name: "Send invite" }));

describe("InviteSheet (plan §8.4, D89)", () => {
  it("invites staff as a receptionist to start with, with a job title", async () => {
    draw();
    await send();
    expect(await screen.findByText("Name needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Email needs a value.")).toBeInTheDocument();
    expect(role("Staff")).toBeChecked();
    expect(preset("Receptionist")).toBeChecked();
    expect(screen.queryByRole("heading", { name: "Doctor details" })).not.toBeInTheDocument();

    await userEvent.type(field(/^Name/), "Meera Pillai");
    await userEvent.type(field(/^Email/), "meera@example.com");
    await userEvent.type(field(/^Job title/), "Front desk");
    await send();
    await waitFor(() =>
      expect(client.invite).toHaveBeenCalledWith({
        fullName: "Meera Pillai",
        email: "meera@example.com",
        role: "STAFF",
        jobTitle: "Front desk",
        permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
        doctor: { specialization: "", qualifications: "", registrationNumber: "", fee: "" },
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Invite sent to meera@example.com");
  });

  it("invites a doctor with the doctor's preset and their details", async () => {
    draw();
    await userEvent.click(role("Doctor"));
    expect(preset("Doctor")).toBeChecked();
    expect(within(sheet()).queryByRole("textbox", { name: /^Job title/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Doctor details" })).toBeInTheDocument();

    await userEvent.type(field(/^Name/), "Rahul Nair");
    await userEvent.type(field(/^Email/), "rahul@example.com");
    await userEvent.type(field(/^Specialization/), "Orthodontist");
    await userEvent.type(field(/^Consultation fee/), "700");
    expect(field(/^Specialization/)).toHaveValue("Orthodontist");
    await send();
    await waitFor(() =>
      expect(client.invite).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "DOCTOR",
          permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
          doctor: { specialization: "Orthodontist", qualifications: "", registrationNumber: "", fee: "700" },
        }),
      ),
    );
  });

  it("starts a manager's invite from what they may give", async () => {
    draw(["patients.view", "patients.create"]);
    expect(screen.getByRole("checkbox", { name: "See patients" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Book appointments" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Book appointments" })).toBeDisabled();
  });

  it("keeps an invite whose email didn't go, and says to resend it", async () => {
    client.invite.mockResolvedValue({ member: aTeamMember({ status: "INVITED" }), emailSent: false });
    draw();
    await userEvent.type(field(/^Name/), "Meera Pillai");
    await userEvent.type(field(/^Email/), "meera@example.com");
    await send();
    const card = await screen.findByRole("alertdialog", { name: "The invite is saved, but its email didn’t go" });
    expect(card).toHaveTextContent("Send it with Resend once email is working.");
  });

  it("says why it could not invite, and keeps what was typed", async () => {
    client.invite.mockRejectedValue(new ApiError(409, "MEMBER_ALREADY_EXISTS", "This person is already in a clinic."));
    draw();
    await userEvent.type(field(/^Name/), "Meera Pillai");
    await userEvent.type(field(/^Email/), "meera@example.com");
    await send();
    expect(await screen.findByRole("alertdialog", { name: "The invite wasn’t sent" })).toHaveTextContent(
      "already in a clinic",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(field(/^Email/)).toHaveValue("meera@example.com");
  });
});
