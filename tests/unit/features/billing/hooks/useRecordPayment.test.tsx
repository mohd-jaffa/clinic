import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentKind } from "@/constants/statuses";
import type { PaymentInput } from "@/lib/validation";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { record: vi.fn() }, revalidated: [] as unknown[] }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/lib/query/useApiMutation", async (actual) => {
  const real = await actual<typeof import("@/lib/query/useApiMutation")>();
  return {
    useApiMutation: (action: never, options: { revalidate?: unknown[] }) => {
      revalidated.push(options.revalidate);
      return real.useApiMutation(action, options as never);
    },
  };
});

const { useRecordPayment } = await import("@/features/billing/hooks/useRecordPayment");

const input: PaymentInput = {
  patientId: "p-1",
  kind: "PAYMENT",
  amount: "1,200",
  paidOn: "2026-10-19",
  method: "UPI",
  reference: "",
  note: "",
};
const onDone = vi.fn();

function Record({
  kind = "PAYMENT",
  patient = { id: "p-1", name: "Asha Rao" },
}: {
  kind?: PaymentKind;
  patient?: { id: string; name: string } | null;
}) {
  const { record, submitting } = useRecordPayment({ kind, patient, billId: "b-1", onDone });
  return (
    <button type="button" aria-busy={submitting} onClick={() => void record({ ...input, kind }, "Asha Rao")}>
      Record
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useRecordPayment (plan §15.3; D322 – D324)", () => {
  it("records once per key, closes, says how much from whom and the balance now, and reads the bill again", async () => {
    client.record.mockResolvedValue({ paymentId: "pay-1", balancePaise: -20_000 });
    render(<Record />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(client.record).toHaveBeenCalledWith({ input, key: expect.any(String) }));
    expect((await screen.findAllByText("₹1,200 received from Asha Rao"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Balance now: ₹200 advance.")[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(revalidated.at(-1)).toContain("/api/bills/b-1");

    // Recorded, the next one is new.
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(client.record).toHaveBeenCalledTimes(2));
    expect(client.record.mock.calls[1][0].key).not.toBe(client.record.mock.calls[0][0].key);
  });

  it("says a refund in its own words, and reads nothing of a patient not yet chosen", async () => {
    client.record.mockResolvedValue({ paymentId: "pay-2", balancePaise: 0 });
    render(<Record kind="REFUND" patient={null} />, { wrapper: Providers });
    expect(revalidated[0]).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    expect((await screen.findAllByText("₹1,200 refunded to Asha Rao"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Balance now: Nothing due.")[0]).toBeInTheDocument();
  });

  it("says why it was not recorded, in a payment's words or a refund's, and keeps its key", async () => {
    client.record.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "Archived."));
    const { unmount } = render(<Record />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByRole("alertdialog", { name: "The payment wasn’t recorded" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    unmount();

    render(<Record kind="REFUND" />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByRole("alertdialog", { name: "The refund wasn’t recorded" })).toBeInTheDocument();
  });
});
