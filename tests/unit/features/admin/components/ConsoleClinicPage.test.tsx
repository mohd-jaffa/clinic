import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleClinicDetail } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { clinic } = vi.hoisted(() => ({
  clinic: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/admin/hooks/useConsoleClinic", () => ({ useConsoleClinic: () => clinic.current }));

const { ConsoleClinicPage } = await import("@/features/admin/components/ConsoleClinicPage");

const draw = () => render(<ConsoleClinicPage clinicId="c-1" />, { wrapper: Providers });

beforeEach(() => {
  clinic.current = { data: aConsoleClinicDetail() };
});

describe("ConsoleClinicPage (plan §20.3; D370)", () => {
  it("names the clinic, its kind and city, and its plan: last day, state, sign-up and members", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Smile Care" })).toBeInTheDocument();
    expect(screen.getByText("Dental · Kochi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/admin/clinics");
    const plan = screen.getByRole("region", { name: "Plan" });
    expect(plan).toHaveTextContent("PlanMonthly");
    expect(plan).toHaveTextContent("Valid until10 Dec 2026");
    expect(plan).toHaveTextContent("StateActive");
    expect(plan).toHaveTextContent("Members3");
  });

  it("opens Extend plan from the plan, and closes it again (plan §7.4; D373)", async () => {
    draw();
    await userEvent.click(
      within(screen.getByRole("region", { name: "Plan" })).getByRole("button", { name: "Extend plan" }),
    );
    const sheet = screen.getByRole("dialog", { name: "Extend the plan for Smile Care" });
    expect(within(sheet).getByRole("radio", { name: "Monthly" })).toBeChecked();
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Extend the plan for Smile Care" })).not.toBeInTheDocument();
  });

  it("gives the owner, with Call, WhatsApp and Email to reach them, the chat and the email empty (D370)", () => {
    draw();
    const owner = screen.getByRole("region", { name: "Owner" });
    expect(owner).toHaveTextContent("+91 98450 12345");
    expect(within(owner).getByRole("link", { name: "Call Asha Menon" })).toHaveAttribute("href", "tel:+919845012345");
    expect(within(owner).getByRole("link", { name: "WhatsApp Asha Menon" })).toHaveAttribute(
      "href",
      "https://wa.me/919845012345",
    );
    expect(within(owner).getByRole("link", { name: "Email Asha Menon" })).toHaveAttribute(
      "href",
      "mailto:asha@smilecare.in",
    );
  });

  it("offers only Email to an owner with no mobile", () => {
    const detail = aConsoleClinicDetail();
    clinic.current = { data: { ...detail, owner: { ...detail.owner, phone: null } } };
    draw();
    const owner = screen.getByRole("region", { name: "Owner" });
    expect(owner).toHaveTextContent("MobileNot added");
    expect(
      within(owner)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Email"]);
  });

  it("lists every change to its plan the latest first: how it was paid and its receipt, or why, and who recorded it", () => {
    draw();
    const [paid, given] = within(screen.getByRole("list", { name: "Plan history" })).getAllByRole("listitem");
    expect(paid).toHaveTextContent("Until 10 Dec 2026");
    expect(paid).toHaveTextContent("Monthly · Paid 28 Oct 2026 · UPI · UPI-4821 · Receipt R/2026-27/0001");
    expect(paid).toHaveTextContent(/Jaffa · 28 Oct 2026/);
    expect(paid).toHaveTextContent("₹300");
    expect(given).toHaveTextContent("Set date · Ten days for the move");
    expect(given).toHaveTextContent("Someone no longer here");
    expect(given).toHaveTextContent("No charge");
    // Money received has its receipt, to send the owner a copy (D395); a change at no charge has none.
    expect(within(paid).getByRole("link", { name: "Receipt R/2026-27/0001" })).toHaveAttribute(
      "href",
      "/api/admin/payments/sp-2/receipt.pdf",
    );
    expect(within(given).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when nothing has been recorded", () => {
    clinic.current = { data: aConsoleClinicDetail({ payments: [] }) };
    draw();
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
  });

  it("waits, and says when it could not be loaded, and tries again", async () => {
    clinic.current = { data: undefined };
    const { unmount } = draw();
    expect(screen.getByRole("heading", { level: 1, name: "Clinic" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    unmount();
    const mutate = vi.fn();
    clinic.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("This clinic couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
