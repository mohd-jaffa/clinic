import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OutstandingPatient } from "@/features/billing/types";

const { list } = vi.hoisted(() => ({ list: { current: {} as { data?: unknown } } }));
vi.mock("@/features/billing/hooks/useOutstanding", () => ({ useOutstanding: () => list.current }));

const { OutstandingList } = await import("@/features/billing/components/OutstandingList");

const owing: OutstandingPatient = {
  patient: {
    id: "p-1",
    name: "Rohan Mehta",
    number: 1042,
    phone: "+919876543210",
    dateOfBirth: "1990-01-01",
    gender: "MALE",
    archived: false,
  },
  balancePaise: 120_000,
};
const clinic = { name: "Smile Dental", phone: "0484 234 5678" };

beforeEach(() => {
  vi.clearAllMocks();
  list.current = { data: [owing, { ...owing, patient: { ...owing.patient, id: "p-2", archived: true } }] };
});

describe("OutstandingList (plan §15.4; D321)", () => {
  it("lists who owes, most first, with Call, the dues reminder on WhatsApp, and Record payment", async () => {
    const onRecord = vi.fn();
    render(<OutstandingList clinic={clinic} canRecord onRecord={onRecord} />);
    const [rohan, archived] = within(screen.getByRole("list", { name: "Outstanding" })).getAllByRole("listitem");
    expect(rohan).toHaveTextContent("P-1042 · 98765 43210");
    expect(rohan).toHaveTextContent("₹1,200 due");
    expect(within(rohan).getByRole("link", { name: /^Rohan Mehta/ })).toHaveAttribute("href", "/patients/p-1");
    expect(within(rohan).getByRole("link", { name: "Call Rohan Mehta" })).toHaveAttribute("href", "tel:+919876543210");
    const whatsApp = within(rohan).getByRole("link", { name: "Remind Rohan Mehta on WhatsApp of what’s due" });
    expect(decodeURIComponent(whatsApp.getAttribute("href")!)).toContain(
      "Hello Rohan, a balance of ₹1,200 is due at Smile Dental. Reply or call 0484 234 5678.",
    );
    await userEvent.click(within(rohan).getByRole("button", { name: "Record a payment from Rohan Mehta" }));
    expect(onRecord).toHaveBeenCalledWith(owing);

    // An archived patient's balance still counts; nothing is recorded for them until restored.
    expect(archived).toHaveTextContent("Archived");
    expect(within(archived).queryByRole("button", { name: /^Record/ })).not.toBeInTheDocument();
  });

  it("reminds without a clinic phone, offers no Record payment to someone who may not, and says when no one owes", () => {
    const first = render(
      <OutstandingList clinic={{ name: "Smile Dental", phone: null }} canRecord={false} onRecord={vi.fn()} />,
    );
    const whatsApp = screen.getAllByRole("link", { name: /^Remind Rohan Mehta/ })[0];
    expect(decodeURIComponent(whatsApp.getAttribute("href")!)).toContain("Reply with any questions.");
    expect(screen.queryByRole("button", { name: /^Record/ })).not.toBeInTheDocument();
    first.unmount();

    list.current = { data: [] };
    render(<OutstandingList clinic={clinic} canRecord onRecord={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No one owes" })).toBeInTheDocument();
  });
});
