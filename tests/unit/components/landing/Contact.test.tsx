import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Contact } from "@/components/landing/Contact";
import { UI_TEXT } from "@/constants/messages";

const words = UI_TEXT.landing;

const links = (name: string) => screen.queryAllByRole("link", { name });

describe("Contact (plan §6, §21)", () => {
  it("offers the renewal contact by Call, WhatsApp and Email, the words already typed", () => {
    render(<Contact contact={{ name: "Asha", phone: "+919876543210", email: "asha@example.com" }} />);
    expect(screen.getByRole("region", { name: words.contact.title })).toBeInTheDocument();
    expect(screen.getByText("Talk to Asha.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Asha" })).toHaveAttribute("href", "tel:+919876543210");
    const whatsApp = screen.getByRole("link", { name: "WhatsApp Asha" });
    expect(whatsApp.getAttribute("href")).toContain("wa.me/919876543210");
    expect(decodeURIComponent(whatsApp.getAttribute("href")!)).toContain(words.contact.message("ClinicDesk"));
    expect(whatsApp).toHaveAttribute("target", "_blank");
    const email = screen.getByRole("link", { name: "Email Asha" });
    expect(email.getAttribute("href")).toMatch(/^mailto:asha@example\.com\?subject=About%20ClinicDesk/);
  });

  it("shows each part only once set", () => {
    render(<Contact contact={{ name: null, phone: null, email: "hi@example.com" }} />);
    expect(screen.getByText(words.contact.talkToUs)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.contact.email })).toBeInTheDocument();
    expect(links(words.contact.call)).toEqual([]);
    expect(links(words.contact.whatsApp)).toEqual([]);
  });

  it("is left out with no way to reach them, a name alone included", () => {
    render(<Contact contact={{ name: "Asha", phone: null, email: null }} />);
    expect(screen.queryByRole("region", { name: words.contact.title })).not.toBeInTheDocument();
  });
});
