import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Visit, VisitNotes } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({
  client: { change: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { NotesSection } = await import("@/features/visits/components/NotesSection");

const EMPTY: VisitNotes = { complaint: null, diagnosis: null, notes: null };

const aVisit = (notes: Partial<VisitNotes> = {}): Visit => ({
  id: "v-1",
  status: "OPEN",
  billingStatus: null,
  day: "2026-10-13",
  startedAt: "2026-10-13T05:00:00Z",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Iyer", number: 1012, dateOfBirth: "1990-04-12", gender: "FEMALE", archived: false },
  doctorId: "d-1",
  doctorName: "Maya Rao",
  doctorRegistration: "KMC 12345",
  prescription: null,
  appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: null },
  alerts: [],
  ...EMPTY,
  ...notes,
  followUpOn: null,
  vitals: null,
});

const draw = (notes: Partial<VisitNotes> = {}, writes = true) =>
  render(
    <Providers>
      <NotesSection visit={aVisit(notes)} writes={writes} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "Complaint, diagnosis and notes" });
const field = (name: string) => within(section()).getByRole("textbox", { name });
const save = () => within(section()).queryByRole("button", { name: "Save notes" });

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("NotesSection (plan §12.2; D202, D206)", () => {
  it("reads out only what was written, under its name, to whoever may only read", () => {
    const { unmount } = draw({ complaint: "Fever, 3 days", notes: "Rest\nFluids" }, false);
    const terms = within(section())
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual(["Complaint", "Notes"]);
    expect(within(section()).getByText(/Rest\s+Fluids/)).toBeInTheDocument();
    expect(within(section()).queryByRole("textbox")).not.toBeInTheDocument();
    unmount();

    draw({}, false);
    expect(within(section()).getByText("Nothing recorded")).toBeInTheDocument();
  });

  it("holds what was written in its fields, saving it from the copy read with Save notes", async () => {
    client.change.mockResolvedValue({ complaint: "Fever, 3 days", diagnosis: "Viral fever", notes: null });
    draw({ complaint: "Fever, 3 days" });
    expect(field("Complaint")).toHaveValue("Fever, 3 days");
    expect(save()).not.toBeInTheDocument();
    await userEvent.type(field("Diagnosis"), "Viral fever");
    await userEvent.click(save()!);
    expect(client.change).toHaveBeenCalledWith({
      id: "v-1",
      input: {
        section: "NOTES",
        changes: { complaint: "Fever, 3 days", diagnosis: "Viral fever", notes: "" },
        seen: { complaint: "Fever, 3 days", diagnosis: null, notes: null },
      },
    });
    expect((await screen.findAllByText("Notes saved"))[0]).toBeInTheDocument();
    await waitFor(() => expect(save()).not.toBeInTheDocument());
    expect(field("Diagnosis")).toHaveValue("Viral fever");
  });

  it("reads the visit again when someone saved them meanwhile — and not for any other failure", async () => {
    client.change.mockRejectedValueOnce(new ApiError(409, "VISIT_CHANGED", "Changed."));
    client.change.mockRejectedValueOnce(new ApiError(422, "PATIENT_ARCHIVED", "Archived."));
    draw();
    await userEvent.type(field("Notes"), "Rest");
    await userEvent.click(save()!);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(["/api/visits/v-1"]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    refresh.mockClear();
    await userEvent.click(save()!);
    await waitFor(() => expect(client.change).toHaveBeenCalledTimes(2));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps what is typed when someone saves meanwhile, showing theirs, which Use theirs takes", async () => {
    const { rerender } = draw({ complaint: "Fever" });
    await userEvent.type(field("Notes"), "Rest");
    rerender(
      <Providers>
        <NotesSection visit={aVisit({ complaint: "Fever", diagnosis: "Dengue" })} writes />
      </Providers>,
    );
    const notice = within(section()).getByRole("status");
    expect(within(notice).getByText("Dengue")).toBeInTheDocument();
    expect(field("Notes")).toHaveValue("Rest");
    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(field("Diagnosis")).toHaveValue("Dengue");
    expect(field("Notes")).toHaveValue("");
  });
});
