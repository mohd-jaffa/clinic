import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { Settings } = await import("@/features/auth/components/Settings");

beforeEach(() => {
  auth.current = authStub();
});

function settings() {
  render(
    <Providers>
      <Settings />
    </Providers>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });
const links = (region: HTMLElement) =>
  within(region)
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("Settings", () => {
  it("is named on the land, with the clinic under it", () => {
    settings();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Smile Care")).toBeInTheDocument();
  });

  it("leads with who is signed in, opening My account", () => {
    settings();
    const you = section("You");
    expect(within(you).getByRole("link", { name: "Asha Menon" })).toHaveAttribute("href", "/settings/account");
    expect(you).toHaveTextContent("Name, mobile, password, theme");
  });

  it("shows the owner the clinic's setup and the plan and records, each row saying what it holds", () => {
    settings();
    expect(links(section("Clinic setup"))).toEqual([
      "Clinic details",
      "Price list",
      "Appointment types",
      "Expense categories",
      "Holidays and leave",
    ]);
    const owner = section("Plan and records");
    expect(links(owner)).toEqual(["Plan", "Activity", "Import patients", "Export", "Delete clinic"]);
    expect(within(owner).getByRole("link", { name: "Delete clinic" })).toHaveAttribute(
      "href",
      "/settings/delete-clinic",
    );
    expect(owner).toHaveTextContent("Ask to delete the clinic");
  });

  it("shows a member only the rows their permissions open", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["settings.manage"] });
    settings();
    expect(section("Clinic setup")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Plan and records" })).not.toBeInTheDocument();
  });

  it("is only You and Sign out for someone with neither", async () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"], signOut: vi.fn() });
    settings();
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"))).toEqual([
      "settings-you",
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Sign out" }));
    expect(auth.current.signOut).toHaveBeenCalledOnce();
  });

  it("draws nothing without a membership", () => {
    auth.current = authStub({ membership: null });
    settings();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
