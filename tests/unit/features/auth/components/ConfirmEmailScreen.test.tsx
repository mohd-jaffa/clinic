import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, loadPage } = vi.hoisted(() => ({
  client: { confirmEmail: vi.fn(), resendConfirmation: vi.fn() },
  loadPage: vi.fn(),
}));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));
vi.mock("@/lib/navigation/url", () => ({ loadPage }));

const { ConfirmEmailScreen } = await import("@/features/auth/components/ConfirmEmailScreen");

beforeEach(() => {
  vi.clearAllMocks();
  client.confirmEmail.mockResolvedValue({});
});
afterEach(() => window.history.replaceState(null, "", "/"));

function arrive(at: string) {
  window.history.replaceState(null, "", at);
  render(
    <Providers>
      <ConfirmEmailScreen />
    </Providers>,
  );
}

describe("ConfirmEmailScreen", () => {
  it("confirms with the link's tokens, wiped from the address, and loads Home signed in", async () => {
    arrive("/confirm-email#access_token=a-1&refresh_token=r-1&type=magiclink");

    expect(screen.getByText("Confirming your email…")).toHaveAttribute("role", "status");
    await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/home"));
    expect(client.confirmEmail).toHaveBeenCalledWith({ accessToken: "a-1", refreshToken: "r-1" });
    expect(window.location.hash).toBe("");
  });

  it("says a link the server refused has expired, in its words, and offers it again", async () => {
    client.confirmEmail.mockRejectedValue(new ApiError(401, "AUTH_LINK_INVALID", "This link has already been used."));
    arrive("/confirm-email#access_token=a-1&refresh_token=r-1");

    expect(await screen.findByRole("heading", { level: 1, name: "This link has expired" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("This link has already been used.");
    expect(screen.getByRole("button", { name: "Send the link again" })).toBeInTheDocument();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("knows a link used too late without asking the server", async () => {
    arrive("/confirm-email#error=access_denied&error_code=otp_expired");

    expect(await screen.findByRole("heading", { level: 1, name: "This link has expired" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/expired or has already been used/);
    expect(client.confirmEmail).not.toHaveBeenCalled();
  });

  it("asks someone who arrived with no link to check their email, or have it sent again", async () => {
    arrive("/confirm-email");

    expect(await screen.findByText(/Open the link we emailed you/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Email/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });
});
