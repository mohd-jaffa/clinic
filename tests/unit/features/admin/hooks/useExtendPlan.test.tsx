import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsolePlanPayment, PlanExtended } from "@/features/admin/types";
import { ApiError } from "@/lib/api/client";
import type { ExtendPlanInput, ExtendPlanPayload } from "@/lib/validation";
import { aConsoleClinicDetail } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { extend: vi.fn() }, revalidated: [] as unknown[] }));
vi.mock("@/features/admin/api.client", () => ({ ConsoleClient: client }));
vi.mock("@/lib/query/useApiMutation", async (actual) => {
  const real = await actual<typeof import("@/lib/query/useApiMutation")>();
  return {
    useApiMutation: (action: never, options: { revalidate?: unknown[] }) => {
      revalidated.push(options.revalidate);
      return real.useApiMutation(action, options as never);
    },
  };
});

const { useExtendPlan } = await import("@/features/admin/hooks/useExtendPlan");

// The clinic runs until 10 Dec 2026.
const clinic = aConsoleClinicDetail();
const input = { kind: "MONTHLY", amount: "300" } as ExtendPlanInput;
const month = { kind: "MONTHLY", amountPaise: 30_000, method: "UPI" } as ExtendPlanPayload;
const free = { kind: "CUSTOM", amountPaise: 0, method: null } as ExtendPlanPayload;
const onDone = vi.fn();

/** What the server answers: the change recorded, and whether the owner was emailed. */
const answer = (payment: Partial<ConsolePlanPayment>, emailSent: boolean | null): PlanExtended => ({
  clinic,
  payment: { ...clinic.payments[0], validFrom: "2026-12-10", validUntil: "2027-01-10", ...payment },
  emailSent,
});

function Extend({ payload = month, lastDay = "2027-01-10" }: { payload?: ExtendPlanPayload; lastDay?: string }) {
  const { extend, submitting } = useExtendPlan(clinic, onDone);
  return (
    <button type="button" aria-busy={submitting} onClick={() => void extend(input, payload, lastDay)}>
      Go
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useExtendPlan (plan §7.4; D373 – D376)", () => {
  it("asks first, extends once per key, closes, and says the new last day, its receipt and the email", async () => {
    client.extend.mockResolvedValue(answer({}, true));
    render(<Extend />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    const card = await screen.findByRole("alertdialog", { name: "Extend Smile Care to 10 Jan 2027?" });
    expect(
      within(card).getByText("₹300 by UPI is recorded with a receipt, and the owner is emailed."),
    ).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Extend" }));
    await waitFor(() =>
      expect(client.extend).toHaveBeenCalledWith({ clinicId: "c-1", input, key: expect.any(String) }),
    );
    expect((await screen.findAllByText("Smile Care’s plan is extended"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("It now runs until 10 Jan 2027. The owner is emailed.")[0]).toBeInTheDocument();
    expect(screen.getAllByText("R/2026-27/0001")[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(revalidated[0]).toEqual([
      "/api/admin/clinics/c-1",
      "/api/admin/clinics",
      "/api/admin/overview",
      "/api/admin/audit",
    ]);
  });

  it("asks of a date moved earlier in its own words, and records nothing when cancelled", async () => {
    render(<Extend payload={free} lastDay="2026-11-01" />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    const card = await screen.findByRole("alertdialog", { name: "Move Smile Care’s last day to 1 Nov 2026?" });
    expect(
      within(card).getByText("It is recorded as no charge, with your reason, and the owner is emailed."),
    ).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Cancel" }));
    expect(client.extend).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("says a date moved earlier as moved, with no receipt, and no email when it came again", async () => {
    client.extend.mockResolvedValue(
      answer({ kind: "CUSTOM", validFrom: "2026-12-10", validUntil: "2026-11-01", receiptNumber: null }, null),
    );
    render(<Extend payload={free} lastDay="2026-11-01" />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Move the date" }),
    );
    expect((await screen.findAllByText("Smile Care’s last day is moved"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("It now runs until 1 Nov 2026.")[0]).toBeInTheDocument();
    expect(screen.queryByText("Receipt")).not.toBeInTheDocument();
  });

  it("says the plan is changed though the owner's email didn't go (D376)", async () => {
    client.extend.mockResolvedValue(answer({}, false));
    render(<Extend />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Extend" }));
    expect(
      (await screen.findAllByText("Smile Care’s plan is changed, but the owner’s email didn’t go"))[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "It now runs until 10 Jan 2027. Let the owner know yourself with Call, WhatsApp or Email.",
      )[0],
    ).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
  });

  it("says why it wasn't changed, and keeps the sheet open", async () => {
    client.extend.mockRejectedValue(new ApiError(422, "VALIDATION_ERROR", "That value is not valid.", "req_9"));
    render(<Extend />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Extend" }));
    expect((await screen.findAllByText("The plan wasn’t changed"))[0]).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
