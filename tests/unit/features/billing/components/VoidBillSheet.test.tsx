import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import type { BillDetail } from "@/features/billing/types";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { void: vi.fn() } }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

const { VoidBillSheet } = await import("@/features/billing/components/VoidBillSheet");

const bill = {
  id: "b-1",
  number: "2026-27/0042",
  patient: { id: "p-1", name: "Asha Rao" },
  totalPaise: 90_000,
  visitId: null,
  appointmentId: null,
} as BillDetail;
const onClose = vi.fn();
const draw = () => render(<VoidBillSheet bill={bill} open onClose={onClose} />, { wrapper: Providers });
const sheet = () => screen.getByRole("dialog", { name: "Void bill" });

beforeEach(() => {
  vi.clearAllMocks();
  client.void.mockResolvedValue({ balancePaise: 0, visitToBill: false });
});

describe("VoidBillSheet (plan §15.2; D314)", () => {
  it("names the bill, asks why, then asks to be sure before voiding it", async () => {
    draw();
    expect(within(sheet()).getByText("Bill 2026-27/0042")).toBeInTheDocument();
    expect(within(sheet()).getByText("Asha Rao · ₹900")).toBeInTheDocument();
    const reason = within(sheet()).getByRole("textbox", { name: /^Reason/ });
    expect(reason).toHaveAttribute("maxlength", String(TEXT_LIMITS.reason));
    await userEvent.type(reason, "Wrong patient");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Void bill" }));
    const card = await screen.findByRole("alertdialog", { name: "Void bill 2026-27/0042?" });
    await userEvent.click(within(card).getByRole("button", { name: "Void bill" }));
    await waitFor(() =>
      expect(client.void).toHaveBeenCalledWith({ billId: "b-1", input: { reason: "Wrong patient" } }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("asks for a reason first", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Void bill" }));
    expect(await within(sheet()).findByText("Reason needs a value.")).toBeInTheDocument();
    expect(client.void).not.toHaveBeenCalled();
  });
});
