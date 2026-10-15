import { act, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({ client: { setStatus: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useTreatmentStatus } = await import("@/features/treatments/hooks/useTreatmentStatus");

const onDone = vi.fn();
const render = (visitId: string | null = null) =>
  renderHook(() => useTreatmentStatus(aTreatment(), visitId, onDone), { wrapper: Providers }).result;

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useTreatmentStatus (D250, D251)", () => {
  it("puts it on hold at a tap, from the status read, and says so", async () => {
    client.setStatus.mockResolvedValue({ status: "ON_HOLD" });
    const hook = render("v-1");
    await act(() => hook.current.move("HOLD"));
    expect(client.setStatus).toHaveBeenCalledWith({
      id: "t-1",
      input: { status: "ON_HOLD", seen: "IN_PROGRESS", reason: null },
    });
    expect(refresh).toHaveBeenCalledWith([
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
      "/api/visits/v-1",
    ]);
    expect(onDone).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal on hold");
  });

  it("asks before completing it, and completes it only when told to", async () => {
    client.setStatus.mockResolvedValue({ status: "COMPLETED" });
    const hook = render();
    let moving: Promise<unknown>;
    act(() => {
      moving = hook.current.move("COMPLETE");
    });
    const ask = await screen.findByRole("alertdialog", { name: "Complete Root canal?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await act(async () => {
      await moving;
    });
    expect(client.setStatus).not.toHaveBeenCalled();
    act(() => {
      moving = hook.current.move("COMPLETE");
    });
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Complete Root canal?" })).getByRole("button", {
        name: "Complete",
      }),
    );
    await act(async () => {
      await moving;
    });
    expect(client.setStatus).toHaveBeenCalledWith({
      id: "t-1",
      input: { status: "COMPLETED", seen: "IN_PROGRESS", reason: null },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal completed");
  });

  it("asks before cancelling it, with its reason, and answers whether it was", async () => {
    client.setStatus.mockResolvedValue({ status: "CANCELLED" });
    const hook = render();
    let cancelling: Promise<boolean>;
    act(() => {
      cancelling = hook.current.cancel("Patient declined");
    });
    const ask = await screen.findByRole("alertdialog", { name: "Cancel Root canal?" });
    expect(ask).toHaveTextContent("It closes for good, with the reason “Patient declined”.");
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel treatment" }));
    await act(async () => {
      expect(await cancelling).toBe(true);
    });
    expect(client.setStatus).toHaveBeenCalledWith({
      id: "t-1",
      input: { status: "CANCELLED", seen: "IN_PROGRESS", reason: "Patient declined" },
    });

    act(() => {
      cancelling = hook.current.cancel(null);
    });
    const again = await screen.findByRole("alertdialog", { name: "Cancel Root canal?" });
    expect(again).toHaveTextContent("It closes for good.");
    await userEvent.click(within(again).getByRole("button", { name: "Keep it" }));
    await act(async () => {
      expect(await cancelling).toBe(false);
    });
  });

  it("starts a planned one at a tap", async () => {
    client.setStatus.mockResolvedValue({ status: "IN_PROGRESS" });
    const hook = render();
    await act(() => hook.current.move("START"));
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal in progress");
  });

  it("says when it was not changed", async () => {
    client.setStatus.mockRejectedValue(new ApiError(409, "TREATMENT_CHANGED", "Changed"));
    const hook = render();
    await act(() => hook.current.move("START"));
    expect(await screen.findByRole("alertdialog", { name: "That treatment wasn’t changed" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
