import { act, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({
  client: { recordSession: vi.fn(), removeSession: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useTreatmentSession } = await import("@/features/treatments/hooks/useTreatmentSession");

const onSaved = vi.fn();
const onDone = vi.fn();
const ROUTES = ["/api/patients/p-1/summary", "/api/patients/p-1/timeline", "/api/visits/v-1"];
const render = (status: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS") =>
  renderHook(() => useTreatmentSession(aTreatment({ status }), "v-1", { onSaved, onDone }), { wrapper: Providers })
    .result;

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useTreatmentSession (D256, D257, D254)", () => {
  it("saves this visit's session and says so", async () => {
    client.recordSession.mockResolvedValue({ note: "Cleaned", status: "IN_PROGRESS" });
    const hook = render();
    await act(() => hook.current.save({ note: "Cleaned", complete: false, seen: null }));
    expect(client.recordSession).toHaveBeenCalledWith({
      id: "t-1",
      visitId: "v-1",
      input: { note: "Cleaned", complete: false, seen: null },
    });
    expect(refresh).toHaveBeenCalledWith(ROUTES);
    expect(onSaved).toHaveBeenCalledWith({ note: "Cleaned", status: "IN_PROGRESS" });
    expect(onDone).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal: session saved");
  });

  it("says it is completed when the session completed it — and not again once it was", async () => {
    client.recordSession.mockResolvedValue({ note: "Filled", status: "COMPLETED" });
    const hook1 = render();

    await act(() => hook1.current.save({ note: "Filled", complete: true, seen: null }));
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal completed");
    const hook2 = render("COMPLETED");

    await act(() => hook2.current.save({ note: "Filled.", complete: false, seen: { note: "Filled" } }));
    expect((await screen.findAllByRole("status")).at(-1)).toHaveTextContent("Root canal: session saved");
  });

  it("reads theirs again when someone saved it meanwhile, and says it was not saved", async () => {
    client.recordSession.mockRejectedValue(new ApiError(409, "VISIT_CHANGED", "Changed"));
    const hook3 = render();

    await act(() => hook3.current.save({ note: "Mine", complete: false, seen: null }));
    expect(refresh).toHaveBeenCalledWith(ROUTES);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    refresh.mockClear();
    client.recordSession.mockRejectedValue(new ApiError(422, "TREATMENT_CLOSED", "Closed"));
    const hook4 = render();

    await act(() => hook4.current.save({ note: "Mine", complete: false, seen: null }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks before removing it, and removes it only when told to", async () => {
    client.removeSession.mockResolvedValue({ treatmentId: "t-1", visitId: "v-1" });
    const hook = render();
    let removing: Promise<unknown>;
    act(() => {
      removing = hook.current.remove();
    });
    const ask = await screen.findByRole("alertdialog", { name: "Remove Root canal from this visit?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await act(async () => {
      await removing;
    });
    expect(client.removeSession).not.toHaveBeenCalled();
    act(() => {
      removing = hook.current.remove();
    });
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove from this visit" }),
    );
    await act(async () => {
      await removing;
    });
    expect(client.removeSession).toHaveBeenCalledWith({ id: "t-1", visitId: "v-1" });
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal removed from this visit");
  });

  it("says when it was not removed", async () => {
    client.removeSession.mockRejectedValue(new ApiError(422, "TREATMENT_SESSION_KEPT", "Kept"));
    const hook = render();
    let removing: Promise<unknown>;
    act(() => {
      removing = hook.current.remove();
    });
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove from this visit" }),
    );
    await act(async () => {
      await removing;
    });
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t removed" })).toBeInTheDocument();
  });
});
