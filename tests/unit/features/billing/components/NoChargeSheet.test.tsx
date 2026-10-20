import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { noCharge: vi.fn() } }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));

const { NoChargeSheet } = await import("@/features/billing/components/NoChargeSheet");

const onClose = vi.fn();
const onDone = vi.fn();
const draw = () =>
  render(
    <NoChargeSheet
      visit={{ id: "v-1", patient: { id: "p-1", name: "Asha Rao" } }}
      open
      onClose={onClose}
      onDone={onDone}
    />,
    { wrapper: Providers },
  );
const sheet = () => screen.getByRole("dialog", { name: "No charge" });

beforeEach(() => {
  vi.clearAllMocks();
  client.noCharge.mockResolvedValue({ visitId: "v-1" });
});

describe("NoChargeSheet (plan §15.6; D319)", () => {
  it("marks the visit free as a review to start, without asking", async () => {
    draw();
    expect(within(sheet()).getByText("Asha Rao’s visit")).toBeInTheDocument();
    expect(within(sheet()).getByRole("radio", { name: "Review" })).toBeChecked();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Mark No charge" }));
    await waitFor(() =>
      expect(client.noCharge).toHaveBeenCalledWith({ visitId: "v-1", input: { reason: "REVIEW", note: "" } }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("asks a note for Other, and sends it with the reason", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Other" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Mark No charge" }));
    expect(await within(sheet()).findByText("Note needs a value.")).toBeInTheDocument();
    expect(client.noCharge).not.toHaveBeenCalled();
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Note/ }), "Staff family");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Mark No charge" }));
    await waitFor(() =>
      expect(client.noCharge).toHaveBeenCalledWith({
        visitId: "v-1",
        input: { reason: "OTHER", note: "Staff family" },
      }),
    );
  });
});
