import { act, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aFollowUp } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({ client: { note: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ FollowUpsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useFollowUpContact } = await import("@/features/treatments/hooks/useFollowUpContact");

const onDone = vi.fn();
const render = () => renderHook(() => useFollowUpContact(aFollowUp(), onDone), { wrapper: Providers }).result;
const typed = { outcome: "NO_ANSWER" as const, note: "Line busy", snoozeUntil: "" };

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useFollowUpContact (plan §14.3; D271, D274)", () => {
  it("notes it about its follow-up, reads every tab again, closes, and says how it went", async () => {
    client.note.mockResolvedValue({ id: "c-1", patientId: "p-1", outcome: "NO_ANSWER", snoozeUntil: null });
    const hook = render();
    await act(() => hook.current.save(typed));
    expect(client.note).toHaveBeenCalledWith({ ...typed, kind: "TREATMENT", id: "t-1" });
    expect(refresh).toHaveBeenCalledWith(["/api/follow-ups", "/api/follow-ups/counts"]);
    expect(onDone).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Noted for Anita Rao: No answer");
  });

  it("says when one snoozed is back on the list", async () => {
    client.note.mockResolvedValue({ id: "c-1", patientId: "p-1", outcome: "REACHED", snoozeUntil: "2026-10-22" });
    const hook = render();
    await act(() => hook.current.save({ ...typed, outcome: "REACHED", snoozeUntil: "2026-10-22" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Noted for Anita Rao: Reached. Back on the list on 22 Oct.",
    );
  });

  it("says it was not noted, in the API's words, and stays open", async () => {
    client.note.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived.", "req_1"));
    const hook = render();
    await act(() => hook.current.save(typed));
    expect(onDone).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog", { name: "That contact wasn’t noted" })).toBeInTheDocument();
  });
});
