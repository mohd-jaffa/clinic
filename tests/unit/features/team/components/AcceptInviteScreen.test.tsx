import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, loadPage } = vi.hoisted(() => ({
  client: { previewInvite: vi.fn(), acceptInvite: vi.fn() },
  loadPage: vi.fn(),
}));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));
vi.mock("@/lib/navigation/url", () => ({ loadPage }));

const { AcceptInviteScreen } = await import("@/features/team/components/AcceptInviteScreen");

const TOKEN = "t".repeat(43);
const invite = { clinicName: "Smile Care", role: "DOCTOR", fullName: "Rahul Nair", email: "rahul@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  client.previewInvite.mockResolvedValue(invite);
  client.acceptInvite.mockResolvedValue({});
  window.history.replaceState(null, "", `/accept-invite#token=${TOKEN}`);
});
afterEach(() => window.history.replaceState(null, "", "/"));

const draw = () =>
  render(
    <Providers>
      <AcceptInviteScreen />
    </Providers>,
  );

const join = () => userEvent.click(screen.getByRole("button", { name: "Join the clinic" }));

describe("AcceptInviteScreen (plan §8.5)", () => {
  it("names the clinic and the role, then joins with the name, mobile and password — and goes Home", async () => {
    draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Join Smile Care" })).toBeInTheDocument();
    expect(screen.getByText(/You’re joining as a doctor\. You’ll sign in with rahul@example\.com/)).toBeInTheDocument();
    expect(client.previewInvite).toHaveBeenCalledWith(TOKEN);
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("textbox", { name: /^Your name/ })).toHaveValue("Rahul Nair");

    await join();
    expect(await screen.findByText("Mobile number needs a value.")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: /^Mobile number/ }), "9876501234");
    await userEvent.type(screen.getByLabelText(/^Choose a password/), "a good password");
    await join();
    await waitFor(() =>
      expect(client.acceptInvite).toHaveBeenCalledWith({
        token: TOKEN,
        fullName: "Rahul Nair",
        phone: "9876501234",
        password: "a good password",
      }),
    );
    expect(loadPage).toHaveBeenCalledWith("/home");
  });

  it("says a link with no invite in it isn't valid, with the way back to sign in", async () => {
    window.history.replaceState(null, "", "/accept-invite");
    draw();
    expect(await screen.findByRole("heading", { name: "This invite link isn’t valid" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ask the clinic to send you a new one.");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
    expect(client.previewInvite).not.toHaveBeenCalled();
  });

  it("says a link has run out", async () => {
    client.previewInvite.mockRejectedValue(new ApiError(422, "INVITE_EXPIRED", "This invite link has run out."));
    draw();
    expect(await screen.findByRole("heading", { name: "This invite link has run out" })).toBeInTheDocument();
  });

  it("tries again when the invite could not be opened", async () => {
    client.previewInvite.mockRejectedValueOnce(new ApiError(502, "EXTERNAL_SERVICE_ERROR", "Try again in a moment."));
    draw();
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in a moment.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Join Smile Care" })).toBeInTheDocument();
  });

  it("turns to the gone screen when the link was spent meanwhile, and says why else it could not join", async () => {
    client.acceptInvite.mockRejectedValueOnce(
      new ApiError(409, "AUTH_PHONE_ALREADY_EXISTS", "An account with this mobile number already exists."),
    );
    draw();
    await screen.findByRole("heading", { name: "Join Smile Care" });
    await userEvent.type(screen.getByRole("textbox", { name: /^Mobile number/ }), "9876501234");
    await userEvent.type(screen.getByLabelText(/^Choose a password/), "a good password");
    await join();
    expect(await screen.findByRole("alertdialog", { name: "You haven’t joined yet" })).toHaveTextContent(
      "already exists",
    );

    client.acceptInvite.mockRejectedValueOnce(
      new ApiError(400, "INVITE_INVALID", "This invite link isn't valid any more."),
    );
    await userEvent.keyboard("{Escape}");
    await join();
    expect(await screen.findByRole("heading", { name: "This invite link isn’t valid" })).toBeInTheDocument();
    expect(loadPage).not.toHaveBeenCalled();
  });
});
