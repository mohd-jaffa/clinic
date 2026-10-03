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

const { NameSheet } = await import("@/features/auth/components/NameSheet");

const { profile } = aSession();

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  client.updateProfile.mockResolvedValue({ ...profile, fullName: "Asha M" });
});

/** The sheet open, as My account opens it: closing it closes it. */
function Opened({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <NameSheet
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

const field = () => screen.getByRole("textbox", { name: /^Name/ });

describe("NameSheet", () => {
  it("opens on the name as it stands, the cursor in it", () => {
    sheet();
    expect(screen.getByRole("dialog", { name: "Change your name" })).toBeInTheDocument();
    expect(field()).toHaveValue("Asha Menon");
    expect(field()).toHaveFocus();
  });

  it("refuses an empty name beside the field, sending nothing", async () => {
    sheet();
    await userEvent.clear(field());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Your name needs a value.")).toBeInTheDocument();
    expect(client.updateProfile).not.toHaveBeenCalled();
  });

  it("saves the name, reads the session again, closes and says so", async () => {
    const onClose = sheet();
    await userEvent.clear(field());
    await userEvent.type(field(), "Asha M");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(client.updateProfile).toHaveBeenCalledWith({ fullName: "Asha M" });
    // A notice with nothing to do next: read out, and gone by itself.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Name saved"));
    expect(auth.current.reload).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    // Kept for the next time it opens.
    expect(screen.getByRole("textbox", { name: /^Name/, hidden: true })).toHaveValue("Asha M");
  });

  it("says on a card when the name could not be saved, the sheet left open", async () => {
    client.updateProfile.mockRejectedValue(new ApiError(502, "EXTERNAL_SERVICE_ERROR", "Try again in a moment."));
    const onClose = sheet();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "Your details weren’t changed" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("starts empty with no one signed in", () => {
    auth.current = authStub({ profile: null });
    sheet();
    expect(field()).toHaveValue("");
  });
});
