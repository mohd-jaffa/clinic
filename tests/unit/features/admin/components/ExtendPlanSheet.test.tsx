import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { aConsoleClinicDetail } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { extend: vi.fn() } }));
vi.mock("@/features/admin/api.client", () => ({ ConsoleClient: client }));

const { ExtendPlanSheet } = await import("@/features/admin/components/ExtendPlanSheet");

// Monthly, until 10 Dec 2026, at ₹300 a month and ₹3,000 a year.
const clinic = aConsoleClinicDetail();
const onClose = vi.fn();
const sheet = () => screen.getByRole("dialog", { name: "Extend the plan for Smile Care" });
const field = (name: RegExp) => within(sheet()).getByRole("textbox", { name });
const kind = (name: string) => within(sheet()).getByRole("radio", { name });
const submit = () => userEvent.click(within(sheet()).getByRole("button", { name: "Extend plan" }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T06:00:00Z"));
  client.extend.mockResolvedValue({ clinic, payment: clinic.payments[0], emailSent: true });
  render(<ExtendPlanSheet clinic={clinic} open onClose={onClose} />, { wrapper: Providers });
});

afterEach(() => vi.useRealTimers());

describe("ExtendPlanSheet (plan §7.4; D373, D374)", () => {
  it("starts with a month at the live price, paid today by UPI, and the day it will run to", async () => {
    expect(kind("Monthly")).toBeChecked();
    expect(within(sheet()).getByText("New last day · 10 Jan 2027")).toBeInTheDocument();
    expect(within(sheet()).getByText("Now until 10 Dec 2026")).toBeInTheDocument();
    expect(field(/^Amount/)).toHaveValue("300");
    expect(within(sheet()).getByRole("radio", { name: "UPI" })).toBeChecked();
    expect(field(/^Reference/)).toHaveAttribute("maxlength", String(TEXT_LIMITS.reference));
    expect(field(/^Reason/)).toHaveAttribute("maxlength", String(TEXT_LIMITS.reason));

    await userEvent.type(field(/^Reference/), "UPI-4821");
    await submit();
    const card = await screen.findByRole("alertdialog", { name: "Extend Smile Care to 10 Jan 2027?" });
    await userEvent.click(within(card).getByRole("button", { name: "Extend" }));
    await waitFor(() =>
      expect(client.extend).toHaveBeenCalledWith({
        clinicId: "c-1",
        input: {
          kind: "MONTHLY",
          amount: "300",
          paidOn: "2026-10-30",
          method: "UPI",
          reference: "UPI-4821",
          validUntil: "",
          reason: "",
        },
        key: expect.any(String),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("fills in the year's price for Yearly, and keeps an amount of one's own", async () => {
    await userEvent.click(kind("Yearly"));
    expect(within(sheet()).getByText("New last day · 10 Dec 2027")).toBeInTheDocument();
    expect(field(/^Amount/)).toHaveValue("3000");
    await userEvent.clear(field(/^Amount/));
    await userEvent.type(field(/^Amount/), "2,500");
    await userEvent.click(kind("Monthly"));
    expect(field(/^Amount/)).toHaveValue("2,500");
  });

  it("holds a month to money received", async () => {
    await userEvent.clear(field(/^Amount/));
    await submit();
    expect(await within(sheet()).findByText("Amount needs a value.")).toBeInTheDocument();
    expect(client.extend).not.toHaveBeenCalled();
  });

  it("sets a date at ₹0 with its reason, asking how and when only once money is typed", async () => {
    await userEvent.click(kind("Set date"));
    expect(field(/^Amount/)).toHaveValue("0");
    expect(within(sheet()).queryByRole("radio", { name: "UPI" })).not.toBeInTheDocument();
    expect(within(sheet()).queryByRole("button", { name: /^Paid on/ })).not.toBeInTheDocument();

    await submit();
    expect(await within(sheet()).findByText("New last day needs a value.")).toBeInTheDocument();
    expect(within(sheet()).getByText("Reason needs a value.")).toBeInTheDocument();

    await userEvent.type(field(/^Amount/), "500");
    expect(within(sheet()).getByRole("radio", { name: "UPI" })).toBeInTheDocument();
    // What cannot be read as money yet asks for nothing more.
    await userEvent.clear(field(/^Amount/));
    await userEvent.type(field(/^Amount/), "five");
    expect(within(sheet()).queryByRole("radio", { name: "UPI" })).not.toBeInTheDocument();
    await userEvent.clear(field(/^Amount/));

    await userEvent.click(within(sheet()).getByRole("button", { name: /^New last day/ }));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    await userEvent.type(field(/^Reason/), "Recorded a month by mistake");
    await submit();
    const card = await screen.findByRole("alertdialog", { name: "Move Smile Care’s last day to 30 Oct 2026?" });
    expect(
      within(card).getByText("It is recorded as no charge, with your reason, and the owner is emailed."),
    ).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Move the date" }));
    await waitFor(() =>
      expect(client.extend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            kind: "CUSTOM",
            amount: "",
            validUntil: "2026-10-30",
            reason: "Recorded a month by mistake",
          }),
        }),
      ),
    );
  });
});
