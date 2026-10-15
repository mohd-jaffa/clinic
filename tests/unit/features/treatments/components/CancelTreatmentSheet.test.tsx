import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CancelTreatmentSheet } from "@/features/treatments/components/CancelTreatmentSheet";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({ client: { setStatus: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
  client.setStatus.mockResolvedValue({ status: "CANCELLED" });
});

const draw = () =>
  render(
    <Providers>
      <CancelTreatmentSheet treatment={aTreatment()} visitId="v-1" open onClose={vi.fn()} onDone={onDone} />
    </Providers>,
  );
const confirm = async () =>
  userEvent.click(
    within(await screen.findByRole("alertdialog", { name: "Cancel Root canal?" })).getByRole("button", {
      name: "Cancel treatment",
    }),
  );

describe("CancelTreatmentSheet (D250)", () => {
  it("cancels it with the reason typed, asking first", async () => {
    draw();
    const sheet = screen.getByRole("dialog", { name: "Cancel Root canal?" });
    await userEvent.type(within(sheet).getByRole("textbox", { name: /^Reason/ }), "Patient declined");
    await userEvent.click(within(sheet).getByRole("button", { name: "Cancel treatment" }));
    await confirm();
    await waitFor(() =>
      expect(client.setStatus).toHaveBeenCalledWith({
        id: "t-1",
        input: { status: "CANCELLED", seen: "IN_PROGRESS", reason: "Patient declined" },
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("cancels it with no reason when none is typed", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Cancel treatment" }));
    await confirm();
    await waitFor(() =>
      expect(client.setStatus).toHaveBeenCalledWith({
        id: "t-1",
        input: { status: "CANCELLED", seen: "IN_PROGRESS", reason: null },
      }),
    );
  });
});
