import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TreatmentSheet, type TreatmentVisit } from "@/features/treatments/components/TreatmentSheet";
import type { Treatment } from "@/features/treatments/types";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({
  client: { setStatus: vi.fn(), recordSession: vi.fn(), removeSession: vi.fn(), change: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const onClose = vi.fn();
const onEdit = vi.fn();
const onCancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

function sheetOf(
  treatment: Treatment,
  { visit = null, writes = true }: { visit?: TreatmentVisit | null; writes?: boolean } = {},
) {
  const view = (next: Treatment) => (
    <Providers>
      <TreatmentSheet
        treatment={next}
        visit={visit}
        writes={writes}
        open
        onClose={onClose}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </Providers>
  );
  const drawn = render(view(treatment));
  return {
    sheet: () => screen.getByRole("dialog", { name: treatment.name }),
    redraw: (next: Treatment) => drawn.rerender(view(next)),
  };
}

const actions = () => within(screen.getByRole("dialog")).queryByRole("group", { name: "What can be done" });

describe("TreatmentSheet (plan §14.1; D250, D256 – D261)", () => {
  it("says where it stands and its details, its sessions each opening its visit, and starts at its top", async () => {
    const due = addDaysKey(todayKey(), 7);
    const { sheet } = sheetOf(aTreatment({ description: "Upper left molar", nextDueOn: due }), { writes: false });
    expect(sheet()).toHaveTextContent("In progress");
    expect(sheet()).toHaveTextContent("DoctorMaya Rao");
    expect(sheet()).toHaveTextContent("StartedMonday, 12 Oct 2026");
    expect(sheet()).toHaveTextContent("Estimated cost₹4,500");
    expect(sheet()).toHaveTextContent("DescriptionUpper left molar");
    // Read only, its next sitting is a line of its details.
    expect(sheet()).toHaveTextContent("Next due");
    const sessions = within(sheet()).getByRole("list", { name: "Sessions" });
    expect(within(sessions).getByRole("link", { name: "12 Oct 2026 · Maya Rao" })).toHaveAttribute(
      "href",
      "/visits/v-0?from=patient",
    );
    expect(sessions).toHaveTextContent("Access opened");
    await waitFor(() => expect(document.activeElement?.tagName).toBe("DIV"));
    expect(actions()).not.toBeInTheDocument();
  });

  it("says when it closed, and why it was cancelled; no sessions yet, and a former doctor", () => {
    const { sheet } = sheetOf(
      aTreatment({
        status: "CANCELLED",
        doctorName: null,
        cancelledOn: "2026-10-13",
        cancelReason: "Patient declined",
        estimatedCostPaise: null,
        startedOn: null,
        sessions: [{ id: "s-9", visitId: "v-9", day: "2026-10-12", doctorName: null, note: null }],
      }),
    );
    expect(sheet()).toHaveTextContent("DoctorNo longer on the team");
    expect(sheet()).toHaveTextContent("CancelledTuesday, 13 Oct 2026");
    expect(sheet()).toHaveTextContent("ReasonPatient declined");
    expect(sheet()).toHaveTextContent("12 Oct 2026 · No longer on the teamNo note");
    // Closed, it is only edited — no moves, no Cancel, no next sitting.
    expect(
      within(actions()!)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Edit"]);
    expect(within(sheet()).queryByRole("heading", { name: "Next sitting" })).not.toBeInTheDocument();
    sheetOf(aTreatment({ status: "COMPLETED", completedOn: "2026-10-14", sessions: [] }), { writes: false });
    expect(screen.getAllByRole("dialog")[1]).toHaveTextContent("CompletedWednesday, 14 Oct 2026");
    expect(screen.getAllByRole("dialog")[1]).toHaveTextContent("No sessions yet");
  });

  it("offers the moves its status allows, Edit and Cancel; Complete asks first", async () => {
    sheetOf(aTreatment());
    expect(
      within(actions()!)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Complete", "Put on hold", "Edit", "Cancel treatment"]);
    await userEvent.click(screen.getByRole("button", { name: "Edit Root canal" }));
    expect(onEdit).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel treatment" }));
    expect(onCancel).toHaveBeenCalled();
    client.setStatus.mockResolvedValue({ status: "ON_HOLD" });
    await userEvent.click(screen.getByRole("button", { name: "Put on hold" }));
    expect(client.setStatus).toHaveBeenCalledWith({
      id: "t-1",
      input: { status: "ON_HOLD", seen: "IN_PROGRESS", reason: null },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(await screen.findByRole("alertdialog", { name: "Complete Root canal?" })).toBeInTheDocument();
  });

  it("starts a planned one, and resumes one on hold", () => {
    sheetOf(aTreatment({ status: "PLANNED" }));
    expect(within(actions()!).getByRole("button", { name: "Start" })).toBeInTheDocument();
    sheetOf(aTreatment({ id: "b", status: "ON_HOLD" }));
    expect(
      within(screen.getAllByRole("group", { name: "What can be done" })[1])
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Resume", "Edit", "Cancel treatment"]);
  });
});

describe("TreatmentSheet's next sitting (D259)", () => {
  it("is set by a chip, saved alone from the copy read", async () => {
    client.change.mockResolvedValue({ nextDueOn: addDaysKey(todayKey(), 7) });
    const { sheet } = sheetOf(aTreatment());
    expect(within(sheet()).queryByRole("button", { name: "Save next sitting" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "1 week" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save next sitting" }));
    expect(client.change).toHaveBeenCalledWith({
      id: "t-1",
      input: { part: "NEXT_DUE", changes: { nextDueOn: addDaysKey(todayKey(), 7) }, seen: { nextDueOn: null } },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows theirs beside what is chosen when it changed meanwhile, and takes it", async () => {
    const { sheet, redraw } = sheetOf(aTreatment());
    await userEvent.click(within(sheet()).getByRole("radio", { name: "1 month" }));
    redraw(aTreatment({ nextDueOn: addDaysKey(todayKey(), 3) }));
    const theirs = await within(sheet()).findByText("Someone saved this meanwhile");
    expect(theirs.closest("[role=status]")).toHaveTextContent(/\d{4}/);
    await userEvent.click(within(sheet()).getByRole("button", { name: "Use theirs" }));
    expect(within(sheet()).queryByText("Someone saved this meanwhile")).not.toBeInTheDocument();
    redraw(aTreatment({ nextDueOn: null }));
    await userEvent.click(within(sheet()).getByRole("radio", { name: "3 days" }));
    redraw(aTreatment({ nextDueOn: addDaysKey(todayKey(), 14) }));
    redraw(aTreatment({ nextDueOn: null }));
  });
});

describe("TreatmentSheet's next sitting, taken away", () => {
  it("saves no next sitting, and shows theirs as none when it was taken away meanwhile", async () => {
    const due = addDaysKey(todayKey(), 7);
    client.change.mockResolvedValue({ nextDueOn: null });
    const { sheet, redraw } = sheetOf(aTreatment({ nextDueOn: due }));
    await userEvent.click(within(sheet()).getByRole("radio", { name: "3 days" }));
    redraw(aTreatment({ nextDueOn: null }));
    const changed = await within(sheet()).findByText("Someone saved this meanwhile");
    expect(changed.closest("[role=status]")).toHaveTextContent("No next sitting set");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save next sitting" }));
    await waitFor(() => expect(client.change).toHaveBeenCalled());
    expect((await screen.findAllByText("Root canal: no next sitting")).length).toBeGreaterThan(0);
  });
});

describe("TreatmentSheet's session in this visit (D254, D256, D257)", () => {
  const visit = { id: "v-0", open: true };

  it("holds this visit's note; Save once changed, from the copy read, and completes it when ticked", async () => {
    client.recordSession.mockResolvedValue({ note: "Canal filled", status: "COMPLETED" });
    const { sheet } = sheetOf(aTreatment(), { visit });
    const note = within(sheet()).getByRole("textbox", { name: "What was done" });
    expect(note).toHaveValue("Access opened");
    expect(within(sheet()).queryByRole("button", { name: "Save session" })).not.toBeInTheDocument();
    await userEvent.clear(note);
    await userEvent.type(note, "Canal filled");
    await userEvent.click(within(sheet()).getByRole("checkbox", { name: "This completes it" }));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save session" }));
    expect(client.recordSession).toHaveBeenCalledWith({
      id: "t-1",
      visitId: "v-0",
      input: { note: "Canal filled", complete: true, seen: { note: "Access opened" } },
    });
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((one) => one.textContent?.includes("Root canal completed"))).toBe(true),
    );
  });

  it("records a first session even with nothing typed", async () => {
    client.recordSession.mockResolvedValue({ note: null, status: "IN_PROGRESS" });
    const { sheet } = sheetOf(aTreatment({ sessions: [] }), { visit });
    expect(within(sheet()).queryByRole("button", { name: "Remove from this visit" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save session" }));
    expect(client.recordSession).toHaveBeenCalledWith({
      id: "t-1",
      visitId: "v-0",
      input: { note: "", complete: false, seen: null },
    });
  });

  it("removes it while the visit is open, asking first — and not once it is done", async () => {
    client.removeSession.mockResolvedValue({ treatmentId: "t-1", visitId: "v-0" });
    const { sheet } = sheetOf(aTreatment(), { visit });
    await userEvent.click(within(sheet()).getByRole("button", { name: "Remove from this visit" }));
    const ask = await screen.findByRole("alertdialog", { name: "Remove Root canal from this visit?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Remove from this visit" }));
    await waitFor(() => expect(client.removeSession).toHaveBeenCalledWith({ id: "t-1", visitId: "v-0" }));
    sheetOf(aTreatment({ id: "b" }), { visit: { id: "v-0", open: false } });
    expect(
      within(screen.getAllByRole("dialog")[1]).queryByRole("button", { name: "Remove from this visit" }),
    ).not.toBeInTheDocument();
  });

  it("shows theirs beside what is typed when someone saved it meanwhile", async () => {
    const { sheet, redraw } = sheetOf(aTreatment(), { visit });
    await userEvent.type(within(sheet()).getByRole("textbox", { name: "What was done" }), " and more");
    redraw(aTreatment({ sessions: [{ ...aTreatment().sessions[0], note: null }] }));
    const changed = await within(sheet()).findByText("Someone saved this meanwhile");
    expect(changed.closest("[role=status]")).toHaveTextContent("No note");
    redraw(aTreatment({ sessions: [{ ...aTreatment().sessions[0], note: "Theirs" }] }));
    await waitFor(() => expect(changed.closest("[role=status]")).toHaveTextContent("Theirs"));
  });

  it("offers no tick on one already closed, worked on in this visit; and nothing on a closed one it did not touch", () => {
    sheetOf(aTreatment({ status: "COMPLETED", completedOn: "2026-10-14" }), { visit });
    expect(screen.getByRole("textbox", { name: "What was done" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "This completes it" })).not.toBeInTheDocument();
    sheetOf(aTreatment({ id: "b", name: "Crown", status: "CANCELLED", sessions: [] }), { visit });
    expect(
      within(screen.getByRole("dialog", { name: "Crown" })).queryByRole("heading", { name: "This visit" }),
    ).not.toBeInTheDocument();
  });

  it("reads out this visit's note to whoever may only read, or nothing when it was not worked on", () => {
    sheetOf(aTreatment(), { visit, writes: false });
    const sheet = screen.getByRole("dialog", { name: "Root canal" });
    expect(within(sheet).getByRole("heading", { name: "This visit" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("textbox")).not.toBeInTheDocument();
    sheetOf(aTreatment({ id: "b", name: "Crown", sessions: [] }), { visit, writes: false });
    expect(
      within(screen.getByRole("dialog", { name: "Crown" })).queryByRole("heading", { name: "This visit" }),
    ).not.toBeInTheDocument();
    sheetOf(aTreatment({ id: "c", name: "Scaling", sessions: [{ ...aTreatment().sessions[0], note: null }] }), {
      visit,
      writes: false,
    });
    expect(screen.getByRole("dialog", { name: "Scaling" })).toHaveTextContent("This visitNo note");
  });
});
