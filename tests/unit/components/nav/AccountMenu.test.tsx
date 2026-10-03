import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { AccountMenu } = await import("@/components/nav/AccountMenu");

beforeEach(() => {
  auth.current = authStub({ signOut: vi.fn(() => new Promise<void>(() => {})) });
});

function menu() {
  render(
    <Providers>
      <AccountMenu />
      <button type="button">Elsewhere</button>
    </Providers>,
  );
  return screen.getByRole("button", { name: "Account: Asha Menon" });
}

const frame = () => act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

describe("AccountMenu", () => {
  it("shows who is signed in, and opens where they work, My account and Sign out", async () => {
    const button = menu();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("Owner");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent("Smile Care · Owner");
    expect(within(panel).getByRole("link", { name: "My account" })).toHaveAttribute("href", "/settings/account");
  });

  it("closes as My account is followed", async () => {
    const button = menu();
    await userEvent.click(button);
    const link = screen.getByRole("link", { name: "My account" });
    link.addEventListener("click", (event) => event.preventDefault());

    await userEvent.click(link);

    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("asks before signing out, then closes and says it is on its way out", async () => {
    const button = menu();
    await userEvent.click(button);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Sign out" }));

    expect(auth.current.signOut).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Signing out…", hidden: true })).toHaveAttribute("aria-busy", "true");
  });

  it("gives way to the question, so staying signed in finds the focus on the account again", async () => {
    const button = menu();
    await userEvent.click(button);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Stay signed in" }));

    await waitFor(() => expect(button).toHaveFocus());
    expect(auth.current.signOut).not.toHaveBeenCalled();
  });

  it("closes on Escape, handing the focus back, and lets Escape pass while closed", async () => {
    const button = menu();
    await userEvent.click(button);
    screen.getByRole("link", { name: "My account" }).focus();

    await userEvent.keyboard("{Escape}");

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open while the focus moves within it, and closes once it has left", async () => {
    const button = menu();
    await userEvent.click(button);

    await userEvent.tab();
    await frame();
    expect(screen.getByRole("link", { name: "My account" })).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.tab();
    await userEvent.tab();
    await frame();
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "false"));
  });

  it("closes on a tap elsewhere", async () => {
    const button = menu();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "false"));
  });

  it("is not drawn without a membership", () => {
    auth.current = authStub({ membership: null });
    render(
      <Providers>
        <AccountMenu />
      </Providers>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
