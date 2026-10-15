import { act, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({ client: { create: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useNewTreatment } = await import("@/features/treatments/hooks/useNewTreatment");

const typed = {
  patientId: "p-1",
  visitId: "v-1",
  doctorId: "",
  start: "IN_PROGRESS" as const,
  name: "Root canal",
  description: "",
  estimatedCost: "",
  note: "",
  nextDueOn: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useNewTreatment (D252, D258)", () => {
  it("adds it, reads the visit, the summary and the history again, and names it", async () => {
    client.create.mockResolvedValue({ id: "t-1", name: "Root canal" });
    const hook = renderHook(() => useNewTreatment({ patientId: "p-1", visitId: "v-1" }), { wrapper: Providers }).result;
    await act(async () => {
      expect(await hook.current.add(typed)).toEqual({ id: "t-1", name: "Root canal" });
    });
    expect(refresh).toHaveBeenCalledWith([
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
      "/api/visits/v-1",
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("Root canal added");
  });

  it("says when it was not added", async () => {
    client.create.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "Archived"));
    const hook = renderHook(() => useNewTreatment({ patientId: "p-1", visitId: null }), { wrapper: Providers }).result;
    await act(async () => {
      expect(await hook.current.add(typed)).toBeUndefined();
    });
    expect(await screen.findByRole("alertdialog", { name: "That treatment wasn’t added" })).toBeInTheDocument();
  });
});
