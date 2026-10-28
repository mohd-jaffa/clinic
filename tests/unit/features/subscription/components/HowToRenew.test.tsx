import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HowToRenew } from "@/features/subscription/components/HowToRenew";
import { aPlan } from "@tests/support/plan";
import { Providers } from "@tests/support/providers";

const draw = (plan = aPlan()) => render(<HowToRenew plan={plan} clinicName="Smile Care" />, { wrapper: Providers });

/** The browser's clipboard, as a test sets it: taking the words, or refusing them. */
function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => vi.restoreAllMocks());

describe("HowToRenew (plan §7.5; D364, D365)", () => {
  it("shows the prices and the renewal contact, with Call, WhatsApp and Email to them", () => {
    draw();
    const section = screen.getByRole("region", { name: "How to renew" });
    expect(within(section).getByText(/renewing early loses no days/)).toBeInTheDocument();
    expect(within(section).getByText("₹300")).toBeInTheDocument();
    expect(within(section).getByText("₹3,000")).toBeInTheDocument();
    expect(within(section).getByText("Jaffa")).toBeInTheDocument();
    expect(within(section).getByText("+91 98450 12345")).toBeInTheDocument();
    expect(within(section).getByText("renew@clinicdesk.in")).toBeInTheDocument();
    expect(within(section).getByText("clinicdesk@okaxis")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Jaffa" })).toHaveAttribute("href", "tel:+919845012345");
  });

  it("opens WhatsApp and the email with the words typed, the clinic named (D365)", () => {
    draw();
    const whatsApp = screen.getByRole("link", { name: "WhatsApp Jaffa" });
    expect(whatsApp).toHaveAttribute(
      "href",
      `https://wa.me/919845012345?text=${encodeURIComponent("Hello, I’d like to renew the plan for Smile Care.")}`,
    );
    expect(whatsApp).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Email Jaffa" })).toHaveAttribute(
      "href",
      `mailto:renew@clinicdesk.in?subject=${encodeURIComponent("Renewing the plan for Smile Care")}&body=${encodeURIComponent(
        "Hello, I’d like to renew the plan for Smile Care.",
      )}`,
    );
  });

  it("copies the UPI id, and says so (D364)", async () => {
    const writeText = clipboard(vi.fn().mockResolvedValue(undefined));
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Copy the UPI id" }));
    expect(writeText).toHaveBeenCalledWith("clinicdesk@okaxis");
    expect(await screen.findByText("UPI id copied")).toBeInTheDocument();
    expect(screen.getByText("Paste it in your UPI app to pay.")).toBeInTheDocument();
  });

  it("says when the browser would not copy it, to copy it by hand", async () => {
    clipboard(vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")));
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Copy the UPI id" }));
    expect(await screen.findByText("The UPI id wasn’t copied")).toBeInTheDocument();
    expect(screen.getByText("Select it and copy it yourself.")).toBeInTheDocument();
  });

  it("leaves out each part of the contact the DEV has not set, and its link with it", () => {
    const { unmount } = draw(aPlan({ contact: { name: null, phone: "+919845012345", email: null, upiId: null } }));
    // No name: the links say only what they do.
    expect(screen.getByRole("link", { name: "Call" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Email/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy the UPI id" })).not.toBeInTheDocument();
    unmount();

    draw(aPlan({ contact: { name: null, phone: null, email: "renew@clinicdesk.in", upiId: null } }));
    expect(screen.getByRole("link", { name: "Email" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();
  });

  it("shows only the prices while no contact is set", () => {
    draw(aPlan({ contact: { name: null, phone: null, email: null, upiId: null } }));
    expect(screen.getByText("₹300")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Mobile")).not.toBeInTheDocument();
  });
});
