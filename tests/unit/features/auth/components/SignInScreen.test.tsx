import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toSessionView } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";
import { aDeveloperSession, aSession } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, loadPage, query } = vi.hoisted(() => ({
  client: { signIn: vi.fn() },
  loadPage: vi.fn(),
  query: { current: new URLSearchParams() },
}));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));
vi.mock("@/lib/navigation/url", () => ({ loadPage }));
vi.mock("next/navigation", () => ({ useSearchParams: () => query.current }));

const { SignInScreen } = await import("@/features/auth/components/SignInScreen");

beforeEach(() => {
  vi.clearAllMocks();
  query.current = new URLSearchParams();
  client.signIn.mockResolvedValue(toSessionView(aSession()));
});

function signIn() {
  render(
    <Providers>
      <SignInScreen />
    </Providers>,
  );
}

async function fill(identifier: string, password: string) {
  await userEvent.type(screen.getByRole("textbox", { name: /Email or mobile number/ }), identifier);
  await userEvent.type(screen.getByLabelText(/^Password/), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInScreen", () => {
  it("asks for an email or a mobile number and the password, with the ways to a new password and a new clinic", () => {
    signIn();
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Set up your clinic" })).toHaveAttribute("href", "/register");
  });

  it("says what is missing beside each field, and sends nothing", async () => {
    signIn();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email or your 10-digit mobile number.")).toBeInTheDocument();
    expect(screen.getByText("Password needs a value.")).toBeInTheDocument();
    expect(client.signIn).not.toHaveBeenCalled();
  });

  it("sends what was typed, and loads Home as a new page", async () => {
    signIn();
    await fill(" 98765 43210 ", "hunter22");

    expect(client.signIn).toHaveBeenCalledWith({ identifier: " 98765 43210 ", password: "hunter22" });
    expect(loadPage).toHaveBeenCalledWith("/home");
  });

  it("returns to the screen the person was heading for", async () => {
    query.current = new URLSearchParams({ next: "/patients/p-1" });
    signIn();
    await fill("asha@example.com", "hunter22");
    expect(loadPage).toHaveBeenCalledWith("/patients/p-1");
  });

  it("sends the platform admin to the console", async () => {
    client.signIn.mockResolvedValue(toSessionView(aDeveloperSession()));
    signIn();
    await fill("dev@example.com", "hunter22");
    expect(loadPage).toHaveBeenCalledWith("/admin");
  });

  it("says why it could not, in the API's words, with its reference", async () => {
    client.signIn.mockRejectedValue(
      new ApiError(401, "AUTH_INVALID_CREDENTIALS", "That email or mobile number and password don’t match.", "req_1"),
    );
    signIn();
    await fill("asha@example.com", "wrong");

    const card = await screen.findByRole("alertdialog", { name: "You’re not signed in" });
    expect(card).toHaveTextContent("That email or mobile number and password don’t match.");
    expect(card).toHaveTextContent("Reference: req_1");
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("offers the link again to an email not yet confirmed", async () => {
    client.signIn.mockRejectedValue(
      new ApiError(403, "AUTH_EMAIL_NOT_CONFIRMED", "Please confirm your email first, with the link we sent you."),
    );
    signIn();
    await fill("asha@example.com", "hunter22");

    const card = await screen.findByRole("alertdialog", { name: "You’re not signed in" });
    expect(within(card).getByRole("link", { name: "Send the link again" })).toHaveAttribute("href", "/confirm-email");
  });
});
