import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { resendConfirmation: vi.fn() } }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { ResendConfirmation } = await import("@/features/auth/components/ResendConfirmation");

beforeEach(() => {
  vi.clearAllMocks();
  client.resendConfirmation.mockResolvedValue({ accepted: true });
});

const resend = (email?: string) =>
  render(
    <Providers>
      <ResendConfirmation email={email} />
    </Providers>,
  );

describe("ResendConfirmation", () => {
  it("sends the link again to the address just signed up with, and says it is on its way", async () => {
    resend("asha@example.com");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));

    expect(client.resendConfirmation).toHaveBeenCalledWith({ email: "asha@example.com" });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Link sent");
  });

  it("asks for the address when it has none, and checks it first", async () => {
    resend();
    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(await screen.findByText("Email needs a value.")).toBeInTheDocument();
    expect(client.resendConfirmation).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole("textbox", { name: /^Email/ }), "asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(client.resendConfirmation).toHaveBeenCalledWith({ email: "asha@example.com" });
  });

  it("says when it could not", async () => {
    client.resendConfirmation.mockRejectedValue(new ApiError(502, "MAIL_NOT_CONFIGURED", "Email isn’t set up yet."));
    resend("asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(await screen.findByRole("alertdialog", { name: "The link wasn’t sent" })).toHaveTextContent(
      "Email isn’t set up yet.",
    );
  });
});
