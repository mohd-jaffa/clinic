import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { changePassword: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { ChangePasswordSheet } = await import("@/features/auth/components/ChangePasswordSheet");

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  const { profile, membership, subscription } = aSession();
  client.changePassword.mockResolvedValue({ profile, membership, subscription });
});

/** The sheet open, as My account opens it: closing it closes it. */
function Opened({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ChangePasswordSheet
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

const current = () => screen.getByLabelText(/^Current password/);
const next = () => screen.getByLabelText(/^New password/);
const change = () => userEvent.click(screen.getByRole("button", { name: "Change password" }));

describe("ChangePasswordSheet", () => {
  it("asks for the current password first, the cursor in it, and the new one's rule", () => {
    sheet();
    expect(screen.getByRole("dialog", { name: "Change password" })).toBeInTheDocument();
    expect(current()).toHaveFocus();
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
  });

  it("tells the password manager whose password it is", () => {
    sheet();
    const username = document.querySelector("input[autocomplete='username']");
    expect(username).toHaveValue("asha@example.com");
    expect(username).not.toBeVisible();
  });

  it("checks both before sending anything", async () => {
    sheet();
    await change();
    expect(await screen.findByText("Current password needs a value.")).toBeInTheDocument();
    expect(screen.getByText("New password needs a value.")).toBeInTheDocument();
    expect(client.changePassword).not.toHaveBeenCalled();
  });

  it("sends both exactly as typed, empties the sheet, and says the other devices are signed out", async () => {
    const onClose = sheet();
    await userEvent.type(current(), " old one ");
    await userEvent.type(next(), " a new one ");
    await change();

    expect(client.changePassword).toHaveBeenCalledWith({ currentPassword: " old one ", newPassword: " a new one " });
    const card = await screen.findByRole("dialog", { name: "Password changed" });
    expect(card).toHaveTextContent("You’re still signed in here, and signed out on your other devices.");
    expect(onClose).toHaveBeenCalledOnce();
    expect(current()).toHaveValue("");
    expect(next()).toHaveValue("");
  });

  it("says beside the current password when it is not right", async () => {
    client.changePassword.mockRejectedValue(
      new ApiError(400, "AUTH_PASSWORD_INCORRECT", "Your current password isn't right."),
    );
    const onClose = sheet();
    await userEvent.type(current(), "wrong");
    await userEvent.type(next(), "a-new-password");
    await change();

    expect(await screen.findByText("Your current password isn't right.")).toBeInTheDocument();
    expect(current()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says any other failure on a card", async () => {
    client.changePassword.mockRejectedValue(new ApiError(502, "EXTERNAL_SERVICE_ERROR", "Try again."));
    sheet();
    await userEvent.type(current(), "old-password");
    await userEvent.type(next(), "a-new-password");
    await change();
    expect(await screen.findByRole("alertdialog", { name: "Your password wasn’t changed" })).toBeInTheDocument();
  });

  it("leaves the username empty with no one signed in", () => {
    auth.current = authStub({ profile: null });
    sheet();
    expect(document.querySelector("input[autocomplete='username']")).toHaveValue("");
  });
});
