import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { requestPasswordReset: vi.fn() } }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { ForgotPasswordScreen } = await import("@/features/auth/components/ForgotPasswordScreen");

beforeEach(() => {
  vi.clearAllMocks();
  client.requestPasswordReset.mockResolvedValue({ accepted: true });
});

function forgot() {
  render(
    <Providers>
      <ForgotPasswordScreen />
    </Providers>,
  );
}

describe("ForgotPasswordScreen", () => {
  it("checks the email, sends a link, and says the same whoever asks, with the way back to sign in", async () => {
    forgot();
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(await screen.findByText("Email needs a value.")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: /^Email/ }), "asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));

    expect(client.requestPasswordReset).toHaveBeenCalledWith({ email: "asha@example.com" });
    const card = await screen.findByRole("dialog", { name: "Check your email" });
    expect(card).toHaveTextContent("If there’s an account for that email");
    expect(within(card).getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("says when the link could not go", async () => {
    client.requestPasswordReset.mockRejectedValue(new ApiError(502, "MAIL_NOT_CONFIGURED", "Email isn’t set up yet."));
    forgot();
    await userEvent.type(screen.getByRole("textbox", { name: /^Email/ }), "asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(await screen.findByRole("alertdialog", { name: "The link wasn’t sent" })).toBeInTheDocument();
  });
});
