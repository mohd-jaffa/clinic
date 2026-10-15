import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FollowUpTab } from "@/constants/statuses";
import type { FollowUp } from "@/features/treatments/types";
import { ApiError } from "@/lib/api/client";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { Providers } from "@tests/support/providers";
import { aFollowUp } from "@tests/support/treatments";

const { client, refresh } = vi.hoisted(() => ({ client: { note: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/treatments/api.client", () => ({ FollowUpsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { FollowUpSheet } = await import("@/features/treatments/components/FollowUpSheet");

const onClose = vi.fn();
const onBook = vi.fn();
const CLINIC = { name: "Smile Care", phone: "0484 234 5678" };
const TREATMENT = "11111111-1111-4111-8111-111111111111";
const CONTACTED = {
  outcome: "NO_ANSWER" as const,
  at: "2026-10-14T05:00:00+00:00",
  note: "Line busy",
  by: "Priya Shah",
};

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
  client.note.mockResolvedValue({ id: "c-1", patientId: "p-1", outcome: "NO_ANSWER", snoozeUntil: null });
});

function sheetOf(
  followUp: FollowUp = aFollowUp(),
  { tab = "TODAY", notes = true, books = true }: { tab?: FollowUpTab; notes?: boolean; books?: boolean } = {},
) {
  render(
    <Providers>
      <FollowUpSheet
        followUp={followUp}
        tab={tab}
        clinic={CLINIC}
        notes={notes}
        books={books}
        open
        onClose={onClose}
        onBook={onBook}
      />
    </Providers>,
  );
  return screen.getByRole("dialog", { name: followUp.patient.name });
}

/** Follows the link as a tap would, without leaving the test's page. */
const follow = async (link: HTMLElement) => {
  link.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(link);
};
const remind = () => screen.queryByRole("link", { name: "Remind Anita Rao on WhatsApp" });
const mark = () => screen.queryByRole("region", { name: "Mark contacted" });

describe("FollowUpSheet (plan §14.3; D272 – D277)", () => {
  it("says whose it is, what for, with whom and when, and the last contact — by whom, with its note", async () => {
    const sheet = sheetOf(aFollowUp({ dueOn: todayKey(), lastContact: CONTACTED }));
    expect(sheet).toHaveTextContent("P-42 · Due today");
    expect(sheet).toHaveTextContent("ForRoot canal");
    expect(sheet).toHaveTextContent("DoctorMaya Rao");
    expect(sheet).toHaveTextContent("Last contactNo answer · 14 Oct, by Priya Shah Line busy");
    // It starts at its top, not in the note.
    await waitFor(() => expect(screen.getByText("P-42 · Due today")).toHaveFocus());
  });

  it("names a visit's as a Follow-up, a doctor gone, and one not yet contacted", () => {
    const sheet = sheetOf(aFollowUp({ kind: "VISIT", id: "v-1", title: null, doctorName: null }));
    expect(sheet).toHaveTextContent("ForFollow-up");
    expect(sheet).toHaveTextContent("DoctorNo longer on the team");
    expect(sheet).toHaveTextContent("Last contactNot contacted yet");
    expect(sheet).toHaveTextContent("Due" + "Thursday, 15 Oct 2026");
  });

  it("reaches them: Call in place, Book, and the profile", async () => {
    sheetOf();
    const actions = screen.getByRole("group", { name: "Reach them" });
    const call = within(actions).getByRole("link", { name: "Call Anita Rao" });
    expect(call).toHaveAttribute("href", "tel:+919876543210");
    expect(call).not.toHaveAttribute("target");
    expect(within(actions).getByRole("link", { name: "Open Anita Rao’s profile" })).toHaveAttribute(
      "href",
      "/patients/p-1",
    );
    await userEvent.click(within(actions).getByRole("button", { name: "Book an appointment for Anita Rao" }));
    expect(onBook).toHaveBeenCalled();
  });

  it("reminds on WhatsApp with the message written, and notes it as Reminder sent as it opens (D273)", async () => {
    sheetOf();
    const link = remind()!;
    expect(link).toHaveAttribute(
      "href",
      "https://wa.me/919876543210?text=" +
        encodeURIComponent(
          "Dr. Maya Rao at Smile Care asked to see you again around 15 Oct. Reply or call 0484 234 5678 to book.",
        ),
    );
    expect(link).toHaveAttribute("target", "_blank");
    await follow(link);
    expect(client.note).toHaveBeenCalledWith({
      kind: "TREATMENT",
      id: "t-1",
      outcome: "REMINDER_SENT",
      note: "",
      snoozeUntil: "",
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledWith(["/api/follow-ups", "/api/follow-ups/counts"]));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says a reminder was not noted, in the API's words", async () => {
    client.note.mockRejectedValue(new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived.", "req_1"));
    sheetOf();
    await follow(remind()!);
    expect(await screen.findByRole("alertdialog", { name: "The reminder wasn’t noted" })).toBeInTheDocument();
  });

  it("for whoever does not note contacts — or a view-only clinic — reminds without noting, and has no Mark contacted", async () => {
    sheetOf(aFollowUp(), { notes: false, books: false });
    await follow(remind()!);
    expect(client.note).not.toHaveBeenCalled();
    expect(mark()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Book/ })).not.toBeInTheDocument();
  });

  it("marks it contacted: how it went is needed; a note and a day to be reminded on go with it (D271, D274)", async () => {
    sheetOf(aFollowUp({ id: TREATMENT }));
    const form = mark()!;
    await userEvent.click(within(form).getByRole("button", { name: "Save contact" }));
    expect(form).toHaveTextContent("Choose how it went.");
    expect(client.note).not.toHaveBeenCalled();
    await userEvent.click(within(form).getByRole("radio", { name: "No answer" }));
    await userEvent.type(within(form).getByRole("textbox", { name: /^Note/ }), "Line busy");
    await userEvent.click(within(form).getByRole("radio", { name: "3 days" }));
    expect(within(form).getByRole("radio", { name: "3 days" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(form).getByRole("button", { name: "Save contact" }));
    await waitFor(() =>
      expect(client.note).toHaveBeenCalledWith({
        kind: "TREATMENT",
        id: TREATMENT,
        outcome: "NO_ANSWER",
        note: "Line busy",
        snoozeUntil: addDaysKey(todayKey(), 3),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("on Completed, is due no more: only Call and the profile (D277)", () => {
    const sheet = sheetOf(aFollowUp({ dueOn: "2026-10-12" }), { tab: "COMPLETED" });
    expect(sheet).toHaveTextContent("P-42 · Completed 12 Oct");
    expect(sheet).toHaveTextContent("CompletedMonday, 12 Oct 2026");
    expect(sheet).not.toHaveTextContent("Last contact");
    expect(screen.getByRole("link", { name: "Call Anita Rao" })).toBeInTheDocument();
    expect(remind()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Book/ })).not.toBeInTheDocument();
    expect(mark()).not.toBeInTheDocument();
  });
});
