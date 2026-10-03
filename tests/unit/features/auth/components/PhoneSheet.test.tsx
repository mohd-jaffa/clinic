import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { updateProfile: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { PhoneSheet } = await import("@/features/auth/components/PhoneSheet");

const { profile } = aSession();

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  client.updateProfile.mockResolvedValue({ ...profile, phone: "+919876500000" });
});

/** The sheet open, as My account opens it: closing it closes it. */
function Opened({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <PhoneSheet
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

function sheet(onClose = vi.fn()) {
  render(
    <Providers>
      <Opened onClose={onClose} />
    </Providers>,
  );
  return onClose;
}

const field = () => screen.getByRole("textbox", { name: /^Mobile number/ });

async function typeAndSave(number: string) {
  await userEvent.clear(field());
  await userEvent.type(field(), number);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("PhoneSheet", () => {
  it("opens on the mobile as it is read, +91 beside it, and says it signs in", () => {
    sheet();
    expect(screen.getByRole("dialog", { name: "Change your mobile number" })).toBeInTheDocument();
    expect(field()).toHaveValue("98765 43210");
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(screen.getByText("You can sign in with this or your email.")).toBeInTheDocument();
  });

  it("starts empty when none has been added", () => {
    auth.current = authStub({ profile: { ...profile, phone: null } });
    sheet();
    expect(field()).toHaveValue("");
  });

  it("refuses a number that is not a mobile beside the field", async () => {
    sheet();
    await typeAndSave("12345");
    expect(await screen.findByText("Enter a valid 10-digit mobile number.")).toBeInTheDocument();
    expect(client.updateProfile).not.toHaveBeenCalled();
  });

  it("saves it as typed, reads the session again, and says it now signs in", async () => {
    const onClose = sheet();
    await typeAndSave("98765 00000");

    expect(client.updateProfile).toHaveBeenCalledWith({ phone: "98765 00000" });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Mobile number saved. You can now sign in with +91 98765 00000.",
      ),
    );
    expect(auth.current.reload).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    // Kept for the next time it opens.
    expect(screen.getByRole("textbox", { name: /^Mobile number/, hidden: true })).toHaveValue("98765 00000");
  });

  it("says beside the field when another account holds the number", async () => {
    client.updateProfile.mockRejectedValue(new ApiError(409, "AUTH_PHONE_ALREADY_EXISTS", "Taken."));
    const onClose = sheet();
    await typeAndSave("98765 00000");

    expect(await screen.findByText("Another account uses this mobile number.")).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says any other refusal on a card", async () => {
    client.updateProfile.mockRejectedValue(new ApiError(422, "CLINIC_PLAN_EXPIRED", "View-only."));
    sheet();
    await typeAndSave("98765 00000");
    expect(await screen.findByRole("alertdialog", { name: "Your details weren’t changed" })).toHaveTextContent(
      "View-only.",
    );
  });
});
