import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, loadPage } = vi.hoisted(() => ({
  client: { completePasswordReset: vi.fn() },
  loadPage: vi.fn(),
}));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));
vi.mock("@/lib/navigation/url", () => ({ loadPage }));

const { ResetPasswordScreen } = await import("@/features/auth/components/ResetPasswordScreen");

beforeEach(() => {
  vi.clearAllMocks();
  client.completePasswordReset.mockResolvedValue({});
});
afterEach(() => window.history.replaceState(null, "", "/"));

function arrive(at: string) {
  window.history.replaceState(null, "", at);
  render(
    <Providers>
      <ResetPasswordScreen />
    </Providers>,
  );
}

const choose = async (password: string) => {
  await userEvent.type(screen.getByLabelText(/^New password/), password);
  await userEvent.click(screen.getByRole("button", { name: "Save and sign in" }));
};

describe("ResetPasswordScreen", () => {
  it("takes the link's tokens out of the address, and saves the new password exactly as typed, signed in at Home", async () => {
    arrive("/reset-password#access_token=a-1&refresh_token=r-1&type=recovery");
    expect(window.location.hash).toBe("");

    await choose("  new-secret  ");

    expect(client.completePasswordReset).toHaveBeenCalledWith({
      accessToken: "a-1",
      refreshToken: "r-1",
      password: "  new-secret  ",
    });
    expect(loadPage).toHaveBeenCalledWith("/home");
  });

  it("checks the password first", async () => {
    arrive("/reset-password#access_token=a-1&refresh_token=r-1");
    await choose("short");
    expect(await screen.findByText("New password must be at least 8 characters.")).toBeInTheDocument();
    expect(client.completePasswordReset).not.toHaveBeenCalled();
  });

  it("sends a link that is spent, or none, to ask for a new one", async () => {
    arrive("/reset-password");
    expect(await screen.findByRole("heading", { level: 1, name: "This link has expired" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("says the link expired when the server finds it spent", async () => {
    client.completePasswordReset.mockRejectedValue(new ApiError(401, "AUTH_LINK_INVALID", "Spent."));
    arrive("/reset-password#access_token=a-1&refresh_token=r-1");
    await choose("new-secret-1");
    expect(await screen.findByRole("heading", { level: 1, name: "This link has expired" })).toBeInTheDocument();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("says when the password could not be saved for any other reason", async () => {
    client.completePasswordReset.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong."));
    arrive("/reset-password#access_token=a-1&refresh_token=r-1");
    await choose("new-secret-1");
    expect(await screen.findByRole("alertdialog", { name: "Your password wasn’t changed" })).toBeInTheDocument();
  });
});
