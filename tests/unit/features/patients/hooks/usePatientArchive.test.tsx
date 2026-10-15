import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Patient } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { archive: vi.fn(), restore: vi.fn() } }));
vi.mock("@/features/patients/api.client", () => ({ PatientsClient: client }));

const { usePatientArchive } = await import("@/features/patients/hooks/usePatientArchive");

const rohan = aPatient();
const archived = { ...rohan, archivedAt: "2026-10-04T05:00:00Z", archivedBy: "Asha Rao" };

const renderArchive = () => renderHook(() => usePatientArchive(rohan), { wrapper: Providers }).result;

let hook: ReturnType<typeof renderArchive>;
beforeEach(() => {
  vi.clearAllMocks();
  hook = renderArchive();
});

describe("usePatientArchive (D122 – D125)", () => {
  it("archives only once asked, says so, and answers that it did", async () => {
    let finish: (value: Patient) => void = () => {};
    client.archive.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive();
    });
    const ask = await screen.findByRole("alertdialog", { name: "Archive Rohan Mehta?" });
    expect(ask).toHaveTextContent("They leave the patients list and search.");
    expect(hook.current.archiving).toBe(false);
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(hook.current.archiving).toBe(true));
    await act(async () => finish(archived));

    expect(await answer!).toBe(true);
    expect(hook.current.archiving).toBe(false);
    expect(client.archive).toHaveBeenCalledWith("p-1");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta archived"));
  });

  it("does nothing when the question is put aside", async () => {
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive();
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(await answer!).toBe(false);
    expect(client.archive).not.toHaveBeenCalled();
  });

  it("says why it was not archived, and answers that it was not", async () => {
    client.archive.mockRejectedValue(
      new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived. Restore them to make changes.", "req_1"),
    );
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive();
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    expect(await answer!).toBe(false);
    expect(await screen.findByRole("alertdialog", { name: "That patient wasn’t archived" })).toHaveTextContent(
      "This patient is archived.",
    );
  });

  it("names the day of an appointment still to come when that is why (D140)", async () => {
    const message = "Cancel or move their appointments to come before archiving them.";
    client.archive.mockRejectedValue(
      new ApiError(422, "PATIENT_HAS_APPOINTMENTS", message, "req_2", { scheduledAt: "2026-10-12T18:45:00Z" }),
    );
    act(() => void hook.current.archive());
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    // 12 Oct at 6:45 PM UTC is already 13 Oct in the clinic.
    expect(
      await screen.findByRole("alertdialog", { name: "Rohan Mehta has an appointment on 13 Oct" }),
    ).toHaveTextContent(message);
  });

  it("says it plainly when the refusal names no day", async () => {
    client.archive.mockRejectedValue(new ApiError(422, "PATIENT_HAS_APPOINTMENTS", "Cancel them first.", "req_3"));
    act(() => void hook.current.archive());
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alertdialog", { name: "That patient wasn’t archived" })).toBeInTheDocument();
  });

  it("names the open treatment when that is why, to whoever may read it (D255)", async () => {
    const message = "Complete or cancel their open treatments before archiving them.";
    client.archive.mockRejectedValue(
      new ApiError(422, "PATIENT_HAS_TREATMENTS", message, "req_4", { name: "Root canal" }),
    );
    act(() => void hook.current.archive());
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Rohan Mehta has an open treatment: Root canal" }),
    ).toHaveTextContent(message);
  });

  it("says only that there is one when the treatment is not named", async () => {
    client.archive.mockRejectedValue(
      new ApiError(422, "PATIENT_HAS_TREATMENTS", "Close it first.", "req_5", { name: null }),
    );
    act(() => void hook.current.archive());
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alertdialog", { name: "Rohan Mehta has an open treatment" })).toBeInTheDocument();
  });

  it("restores without asking, busy meanwhile, and says so", async () => {
    let finish: (value: Patient) => void = () => {};
    client.restore.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let done: Promise<unknown>;
    act(() => {
      done = hook.current.restore();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(hook.current.restoring).toBe(true));
    expect(hook.current.archiving).toBe(false);
    await act(async () => {
      finish(rohan);
      await done;
    });
    expect(client.restore).toHaveBeenCalledWith("p-1");
    expect(hook.current.restoring).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta restored");
  });

  it("says when it was not restored", async () => {
    client.restore.mockRejectedValue(new ApiError(503, "EXTERNAL_SERVICE_ERROR", "No answer", "req_2"));
    await act(async () => {
      await hook.current.restore();
    });
    expect(await screen.findByRole("alertdialog", { name: "That patient wasn’t restored" })).toBeInTheDocument();
  });
});
