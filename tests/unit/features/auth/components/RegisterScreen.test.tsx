import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { register: vi.fn(), resendConfirmation: vi.fn() } }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { RegisterScreen } = await import("@/features/auth/components/RegisterScreen");

beforeEach(() => {
  vi.clearAllMocks();
  client.register.mockResolvedValue({ email: "asha@example.com", trial: true, confirmationSent: true });
  client.resendConfirmation.mockResolvedValue({ accepted: true });
});

function signUp() {
  render(
    <Providers>
      <RegisterScreen />
    </Providers>,
  );
}

const box = (name: RegExp) => screen.getByRole("textbox", { name });

async function fillYou() {
  await userEvent.type(box(/^Your name/), "Asha Menon");
  await userEvent.type(box(/^Email/), "asha@example.com");
  await userEvent.type(box(/^Mobile number/), "98765 43210");
  await userEvent.type(screen.getByLabelText(/^Password/), " secret-pass ");
  await userEvent.click(screen.getByRole("checkbox", { name: "I also see patients" }));
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
}

async function fillClinic() {
  await userEvent.type(box(/^Clinic name/), "Smile Care Dental");
  await userEvent.click(screen.getByRole("combobox", { name: /^Clinic type/ }));
  await userEvent.click(screen.getByRole("option", { name: "Dental" }));
  await userEvent.type(box(/^City/), "Kochi");
  await userEvent.type(box(/^Address/), "12 MG Road");
}

describe("RegisterScreen", () => {
  it("starts with you, step 1 of 2, and the way to sign in instead", () => {
    signUp();
    expect(screen.getByRole("heading", { level: 1, name: "Set up your clinic" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "You" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("checks the first step before the second, by Next or by Enter", async () => {
    signUp();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Your name needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();

    await userEvent.type(box(/^Your name/), "{Enter}");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });

  it("moves to the clinic, announcing it, and back again with nothing lost", async () => {
    signUp();
    await fillYou();

    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Your clinic" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 2, name: "You" })).toHaveFocus();
    expect(box(/^Your name/)).toHaveValue("Asha Menon");
  });

  it("checks the clinic too before anything is sent", async () => {
    signUp();
    await fillYou();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    expect(await screen.findByText("Clinic name needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Choose clinic type.")).toBeInTheDocument();
    expect(client.register).not.toHaveBeenCalled();
  });

  it("sends both steps as typed — the password untouched — and becomes Check your email", async () => {
    signUp();
    await fillYou();
    await fillClinic();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    expect(client.register).toHaveBeenCalledWith({
      fullName: "Asha Menon",
      email: "asha@example.com",
      phone: "98765 43210",
      password: " secret-pass ",
      seesPatients: true,
      clinicName: "Smile Care Dental",
      clinicType: "DENTAL",
      city: "Kochi",
      address: "12 MG Road",
      clinicPhone: "",
    });
    const heading = await screen.findByRole("heading", { level: 1, name: "Check your email" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/We sent a link to asha@example.com/)).toBeInTheDocument();
    expect(screen.queryByText(/had a free trial before/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(client.resendConfirmation).toHaveBeenCalledWith({ email: "asha@example.com" });
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("says why the clinic starts view-only when the mobile has had its free trial (D42)", async () => {
    client.register.mockResolvedValue({ email: "asha@example.com", trial: false, confirmationSent: true });
    signUp();
    await fillYou();
    await fillClinic();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    expect(await screen.findByText(/has had a free trial before/)).toBeInTheDocument();
  });

  it("takes a taken email back to its field on the first step, and says so", async () => {
    client.register.mockRejectedValue(
      new ApiError(409, "AUTH_EMAIL_ALREADY_EXISTS", "An account with this email already exists. Try signing in."),
    );
    signUp();
    await fillYou();
    await fillClinic();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    const card = await screen.findByRole("alertdialog", { name: "Your clinic wasn’t set up" });
    expect(card).toHaveTextContent("An account with this email already exists.");
    await userEvent.click(within(card).getByRole("button", { name: "Close" }));
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(box(/^Email/)).toHaveAccessibleDescription("An account with this email already exists. Try signing in.");
  });

  it("stays on the clinic when the request could not even be made", async () => {
    client.register.mockRejectedValue(new TypeError("Failed to fetch"));
    signUp();
    await fillYou();
    await fillClinic();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    expect(await screen.findByRole("alertdialog", { name: "Your clinic wasn’t set up" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
  });

  it("stays on the clinic for any other refusal", async () => {
    client.register.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong on our side."));
    signUp();
    await fillYou();
    await fillClinic();
    await userEvent.click(screen.getByRole("button", { name: "Create my clinic" }));

    expect(await screen.findByRole("alertdialog", { name: "Your clinic wasn’t set up" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
  });
});
