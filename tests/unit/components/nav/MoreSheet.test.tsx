import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { MoreSheet } = await import("@/components/nav/MoreSheet");

beforeEach(() => {
  auth.current = authStub({ signOut: vi.fn(() => new Promise<void>(() => {})) });
});

function sheet(onClose = vi.fn()) {
  render(
    <Providers>
      <MoreSheet open onClose={onClose} />
    </Providers>,
  );
  return screen.getByRole("dialog", { name: "More" });
}

const stayHere = (link: HTMLElement) => link.addEventListener("click", (event) => event.preventDefault());

describe("MoreSheet", () => {
  it("opens on who is signed in, leading to My account", async () => {
    const onClose = vi.fn();
    const more = sheet(onClose);
    const [first] = within(more).getAllByRole("listitem");

    expect(first).toHaveTextContent("Asha Menon");
    expect(first).toHaveTextContent("Smile Care · Owner");
    const account = within(first).getByRole("link", { name: "Asha Menon" });
    expect(account).toHaveAttribute("href", "/settings/account");

    stayHere(account);
    await userEvent.click(account);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("then the places the bar does not hold, each with what it holds, closing as one is chosen", async () => {
    const onClose = vi.fn();
    const more = sheet(onClose);
    const places = within(within(more).getByRole("navigation", { name: "More" })).getAllByRole("link");

    expect(places.map((link) => link.textContent)).toEqual([
      "Appointments",
      "Follow-ups",
      "Billing",
      "Expenses",
      "Reports",
      "Team",
      "Settings",
    ]);
    expect(within(more).getByText("Bills, payments and dues")).toBeInTheDocument();

    stayHere(places[2]);
    await userEvent.click(places[2]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("holds only the places a member may open", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["payments.view"] });
    const more = sheet();
    const places = within(within(more).getByRole("navigation", { name: "More" })).getAllByRole("link");
    expect(places.map((link) => link.textContent)).toEqual(["Billing", "Settings"]);
  });

  it("ends with Sign out, which asks first and closes the sheet once agreed", async () => {
    const onClose = vi.fn();
    const more = sheet(onClose);

    await userEvent.click(within(more).getByRole("button", { name: "Sign out" }));
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Sign out" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(auth.current.signOut).toHaveBeenCalledOnce();
  });

  it("is not drawn without a membership", () => {
    auth.current = authStub({ membership: null });
    render(
      <Providers>
        <MoreSheet open onClose={vi.fn()} />
      </Providers>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
