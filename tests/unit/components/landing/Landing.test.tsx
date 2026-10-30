import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import type { PublicPricing } from "@/lib/platform/pricing";
import { aDeveloperSession, aSession } from "@tests/support/auth";

vi.mock("@/assets/landing", () => {
  const shot = (name: string, width: number, height: number) => ({
    light: { src: `/${name}-light.webp`, width, height },
    dark: { src: `/${name}-dark.webp`, width, height },
  });
  return {
    LANDING_SHOTS: {
      queue: shot("queue", 780, 1688),
      appointments: shot("appointments", 780, 1688),
      visit: shot("visit", 780, 1688),
      bill: shot("bill", 780, 1688),
      followUps: shot("follow-ups", 780, 1688),
      reports: shot("reports", 780, 1688),
      desktop: shot("desktop", 1440, 900),
    },
  };
});

const { Landing } = await import("@/components/landing/Landing");

const words = UI_TEXT.landing;

const pricing = (overrides: Partial<PublicPricing> = {}): PublicPricing => ({
  trialDays: 30,
  monthlyPaise: 30_000,
  yearlyPaise: 300_000,
  contact: { name: "Asha", phone: "+919876543210", email: "asha@example.com" },
  ...overrides,
});

const links = (name: string) => screen.queryAllByRole("link", { name });

describe("Landing (plan §21; D397 – D401)", () => {
  it("leads with the day, the trial with its live prices, and Sign in", () => {
    render(<Landing session={null} pricing={pricing()} />);
    expect(screen.getByRole("heading", { level: 1, name: words.headline })).toBeInTheDocument();
    expect(links(words.signIn).map((link) => link.getAttribute("href"))).toEqual(["/login"]);
    expect(links(words.startTrial).map((link) => link.getAttribute("href"))).toEqual(["/register", "/register"]);
    expect(screen.getByText("30 days free · then ₹300 a month or ₹3,000 a year")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "₹300 a month, or ₹3,000 a year." })).toBeInTheDocument();
    expect(screen.getByText(words.pricing.trial(30, "ClinicDesk"))).toBeInTheDocument();
  });

  it("walks the day's five parts in order, each with its screen, then the phone and the desk", () => {
    render(<Landing session={null} pricing={pricing()} />);
    const parts = Object.values(words.parts);
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .slice(0, 6)
        .map((heading) => heading.textContent),
    ).toEqual([...parts.map((part) => part.title), words.devices.title]);
    for (const { title, alt } of parts) {
      const part = screen.getByRole("region", { name: title });
      expect(within(part).getAllByRole("img", { name: alt })).toHaveLength(2);
    }
  });

  it("keeps each screen in light and dark, one shown by the theme, the first one's fetched at once", () => {
    render(<Landing session={null} pricing={pricing()} />);
    const [light, dark] = screen.getAllByRole("img", { name: words.queueAlt });
    expect(light).toHaveClass("for-light");
    expect(light.getAttribute("src")).toContain("queue-light.webp");
    expect(dark).toHaveClass("for-dark");
    expect(dark).toHaveAttribute("loading", "eager");
    const [desk] = screen.getAllByRole("img", { name: words.devices.alt });
    expect(desk).toHaveAttribute("loading", "lazy");
    expect(screen.getByText(words.demoNote)).toBeInTheDocument();
  });

  it("adds the renewal contact once the prices are read, the contact from them", () => {
    render(<Landing session={null} pricing={pricing()} />);
    const contact = screen.getByRole("region", { name: words.contact.title });
    expect(within(contact).getByRole("link", { name: "Call Asha" })).toHaveAttribute("href", "tel:+919876543210");
  });

  it("says a one-day trial as one day, and calls nothing free when the trial is none", () => {
    const { rerender } = render(<Landing session={null} pricing={pricing({ trialDays: 1 })} />);
    expect(screen.getByText("1 day free · then ₹300 a month or ₹3,000 a year")).toBeInTheDocument();
    expect(screen.getByText(words.pricing.trial(1, "ClinicDesk"))).toHaveTextContent(/^1 day free first/);

    rerender(<Landing session={null} pricing={pricing({ trialDays: 0 })} />);
    expect(screen.getByText("₹300 a month or ₹3,000 a year")).toBeInTheDocument();
    expect(screen.getByText(words.pricing.noTrial("ClinicDesk"))).toBeInTheDocument();
    expect(links(words.startTrial)).toEqual([]);
    expect(links(words.setUp).map((link) => link.getAttribute("href"))).toEqual(["/register", "/register"]);
  });

  it("leaves the prices out when the settings could not be read, and still offers the trial", () => {
    render(<Landing session={null} pricing={null} />);
    expect(screen.queryByText(/a month/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: words.pricing.titleUnread })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: words.contact.title })).not.toBeInTheDocument();
    expect(links(words.startTrial)).toHaveLength(2);
  });

  it("offers someone signed in their clinic, once, and the prices without the trial", () => {
    const open = words.openApp("ClinicDesk");
    const { rerender } = render(<Landing session={aSession()} pricing={pricing()} />);
    expect(links(open).map((link) => link.getAttribute("href"))).toEqual(["/home"]);
    expect(links(words.signIn)).toEqual([]);
    expect(links(words.startTrial)).toEqual([]);
    expect(screen.getByText("₹300 a month or ₹3,000 a year")).toBeInTheDocument();
    expect(screen.getByText(words.pricing.noTrial("ClinicDesk"))).toBeInTheDocument();

    rerender(<Landing session={aDeveloperSession()} pricing={null} />);
    expect(links(open).map((link) => link.getAttribute("href"))).toEqual(["/admin"]);
    expect(links(words.startTrial)).toEqual([]);
    // No trial pitched, and no prices to show: the section is left out.
    expect(screen.queryByRole("region", { name: words.pricing.titleUnread })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).at(-1)).toHaveTextContent(words.devices.title);
  });

  it("treats a session only the browser can settle as signed out", () => {
    render(<Landing session={undefined} pricing={pricing()} />);
    expect(links(words.signIn)).toHaveLength(1);
  });
});
