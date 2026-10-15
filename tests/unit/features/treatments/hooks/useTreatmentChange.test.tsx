import { act, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({ client: { change: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useTreatmentChange } = await import("@/features/treatments/hooks/useTreatmentChange");

const onSaved = vi.fn();
const onDone = vi.fn();
const render = () =>
  renderHook(() => useTreatmentChange(aTreatment(), null, { onSaved, onDone }), { wrapper: Providers }).result;
const due = (nextDueOn: string) => ({
  part: "NEXT_DUE" as const,
  changes: { nextDueOn },
  seen: { nextDueOn: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useTreatmentChange (D251, D252, D259)", () => {
  it("saves the next sitting and names its day — or that there is none", async () => {
    client.change.mockResolvedValue({ nextDueOn: "2026-10-22" });
    const hook1 = render();

    await act(() => hook1.current.save(due("2026-10-22")));
    expect(client.change).toHaveBeenCalledWith({ id: "t-1", input: due("2026-10-22") });
    expect(refresh).toHaveBeenCalledWith(["/api/patients/p-1/summary", "/api/patients/p-1/timeline"]);
    expect(onSaved).toHaveBeenCalledWith({ nextDueOn: "2026-10-22" });
    expect(onDone).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal: next due Thursday, 22 Oct 2026");
    client.change.mockResolvedValue({ nextDueOn: null });
    const hook2 = render();

    await act(() => hook2.current.save(due("")));
    expect((await screen.findAllByRole("status")).at(-1)).toHaveTextContent("Root canal: no next sitting");
  });

  it("saves its details under the name it now has", async () => {
    client.change.mockResolvedValue({
      name: "Root canal (UL6)",
      description: null,
      estimatedCostPaise: null,
      doctorId: "d-1",
    });
    const input = {
      part: "DETAILS" as const,
      changes: { name: "Root canal (UL6)", description: "", estimatedCost: "", doctorId: "d-1" },
      seen: { name: "Root canal", description: null, estimatedCostPaise: 450000, doctorId: "d-1" },
    };
    const hook3 = render();

    await act(() => hook3.current.save(input));
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal (UL6) saved");
    client.change.mockResolvedValue({ doctorId: "d-2" });
    const hook4 = render();

    await act(() => hook4.current.save(input));
    expect((await screen.findAllByRole("status")).at(-1)).toHaveTextContent("Root canal saved");
  });

  it("reads theirs again when someone changed it meanwhile, and says it was not saved", async () => {
    client.change.mockRejectedValue(new ApiError(409, "TREATMENT_CHANGED", "Changed"));
    const hook5 = render();

    await act(() => hook5.current.save(due("2026-10-22")));
    expect(refresh).toHaveBeenCalledWith(["/api/patients/p-1/summary", "/api/patients/p-1/timeline"]);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    refresh.mockClear();
    client.change.mockRejectedValue(new ApiError(422, "TREATMENT_CLOSED", "Closed"));
    const hook6 = render();

    await act(() => hook6.current.save(due("2026-10-22")));
    expect(refresh).not.toHaveBeenCalled();
  });
});
