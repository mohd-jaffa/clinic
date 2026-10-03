import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { aSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: { updateProfile: vi.fn(), changePassword: vi.fn() } }));

const { MyAccount } = await import("@/features/auth/components/MyAccount");

beforeEach(() => {
  auth.current = authStub();
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

function myAccount() {
  render(
    <ThemeProvider>
      <Providers>
        <MyAccount />
      </Providers>
    </ThemeProvider>,
  );
}

const details = () => screen.getByRole("region", { name: "Your details" });

describe("MyAccount", () => {
  it("names the screen on the land, with the way back to Settings and who they are", () => {
    myAccount();
    expect(screen.getByRole("heading", { level: 1, name: "My account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
    expect(screen.getByText("Smile Care · Owner")).toBeInTheDocument();
  });

  it("shows their details: the name and mobile each open a sheet, the email is only shown", async () => {
    myAccount();
    const region = details();
    expect(region).toHaveTextContent("Asha Menon");
    expect(region).toHaveTextContent("+91 98765 43210");
    expect(region).toHaveTextContent("asha@example.com");
    expect(within(region).queryByRole("button", { name: "Email" })).not.toBeInTheDocument();

    await userEvent.click(within(region).getByRole("button", { name: "Name" }));
    const name = screen.getByRole("dialog", { name: "Change your name" });
    expect(within(name).getByRole("textbox", { name: /^Name/ })).toHaveValue("Asha Menon");
    await userEvent.click(within(name).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(within(region).getByRole("button", { name: "Mobile number" }));
    const phone = screen.getByRole("dialog", { name: "Change your mobile number" });
    expect(within(phone).getByRole("textbox", { name: /^Mobile number/ })).toHaveValue("98765 43210");
  });

  it("says when no mobile has been added yet", () => {
    const { profile } = aSession();
    auth.current = authStub({ profile: { ...profile, phone: null } });
    myAccount();
    expect(details()).toHaveTextContent("Not added yet");
  });

  it("opens Change password in its own sheet", async () => {
    myAccount();
    const password = screen.getByRole("region", { name: "Password" });
    expect(password).toHaveTextContent("Also signs out other devices");
    await userEvent.click(within(password).getByRole("button", { name: "Change password" }));
    expect(screen.getByRole("dialog", { name: "Change password" })).toBeInTheDocument();
  });

  it("switches the theme for this device, as the device decides until one is chosen", async () => {
    myAccount();
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    expect(within(theme).getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByText("Kept on this device only.")).toBeInTheDocument();

    await userEvent.click(within(theme).getByRole("radio", { name: "Dark" }));
    expect(within(theme).getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("ends with Sign out, which asks first", async () => {
    myAccount();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Sign out" }));
    expect(auth.current.signOut).toHaveBeenCalledOnce();
  });

  it("leaves the clinic's line out for someone with no membership, and draws nothing with no one signed in", () => {
    auth.current = authStub({ membership: null });
    myAccount();
    expect(screen.queryByText("Smile Care · Owner")).not.toBeInTheDocument();

    auth.current = authStub({ profile: null });
    render(
      <ThemeProvider>
        <Providers>
          <MyAccount />
        </Providers>
      </ThemeProvider>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
