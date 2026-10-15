import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FollowUp, FollowUpCounts } from "@/features/treatments/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";
import { aFollowUp } from "@tests/support/treatments";

const { auth, list, counts, clinic, panel } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  list: {
    current: { data: [] as FollowUp[] | undefined, isLoading: false, error: undefined as unknown },
    asked: vi.fn(),
  },
  counts: { current: undefined as FollowUpCounts | undefined },
  clinic: { current: undefined as { name: string; phone: string | null } | undefined },
  panel: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/treatments/hooks/useFollowUps", () => ({
  useFollowUps: (tab: string) => {
    list.asked(tab);
    return list.current;
  },
}));
vi.mock("@/features/treatments/hooks/useFollowUpCounts", () => ({
  useFollowUpCounts: () => ({ data: counts.current }),
}));
vi.mock("@/features/clinic/hooks/useClinic", () => ({ useClinic: () => ({ data: clinic.current }) }));
vi.mock("@/features/treatments/components/FollowUpPanel", () => ({
  FollowUpPanel: (props: { followUp: FollowUp | null; open: boolean; onClose: () => void }) => {
    panel(props);
    return props.open ? (
      <div role="dialog" aria-label={props.followUp!.patient.name}>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </div>
    ) : null;
  },
}));

const { FollowUps } = await import("@/features/treatments/components/FollowUps");

const CONTACTED = { outcome: "NO_ANSWER" as const, at: "2026-10-14T05:00:00Z", note: null, by: "Priya Shah" };
const draw = () =>
  render(
    <Providers>
      <FollowUps />
    </Providers>,
  );
const lastPanel = () => panel.mock.lastCall![0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T06:00:00Z"));
  auth.current = authStub({
    role: "STAFF",
    permissions: ["patients.view", "appointments.view", "appointments.create", "appointments.edit"],
  });
  list.current = {
    data: [aFollowUp({ lastContact: CONTACTED }), aFollowUp({ kind: "VISIT", id: "v-1", title: null })],
    isLoading: false,
    error: undefined,
  };
  counts.current = { TODAY: 2, OVERDUE: 4, UPCOMING: 0, LAPSED: 1, COMPLETED: 3 };
  clinic.current = { name: "Smile Care", phone: "0484 234 5678" };
});
afterEach(() => vi.useRealTimers());

describe("FollowUps (plan §14.3; D267 – D278)", () => {
  it("opens on Today, each tab with how many it holds", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Follow-ups", level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "Follow-ups by when they’re due" });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Today2", "Overdue4", "Upcoming0", "Lapsed1", "Completed3"]);
    expect(within(tabs).getByRole("tab", { name: "Today 2" })).toHaveAttribute("aria-selected", "true");
    expect(list.asked).toHaveBeenLastCalledWith("TODAY");
    expect(screen.queryByText("Your patients")).not.toBeInTheDocument();
  });

  it("names the tabs alone until their counts come", () => {
    counts.current = undefined;
    draw();
    expect(screen.getByRole("tab", { name: "Today" })).toBeInTheDocument();
  });

  it("lists each: the patient, what is due with whom, when, the last contact, and Call at its end (D272)", () => {
    draw();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Anita Rao");
    expect(rows[0]).toHaveTextContent("Root canal · Maya Rao");
    expect(rows[0]).toHaveTextContent("Due today");
    expect(rows[0]).toHaveTextContent("No answer, 14 Oct");
    expect(within(rows[0]).getByRole("link", { name: "Call Anita Rao" })).toHaveAttribute("href", "tel:+919876543210");
    expect(rows[1]).toHaveTextContent("Follow-up · Maya Rao");
  });

  it("opens a row's sheet with what it may do there, and closes it", async () => {
    draw();
    await userEvent.click(screen.getAllByRole("button", { name: "Anita Rao" })[0]);
    expect(screen.getByRole("dialog", { name: "Anita Rao" })).toBeInTheDocument();
    expect(lastPanel()).toMatchObject({
      followUp: { id: "t-1" },
      tab: "TODAY",
      clinic: { name: "Smile Care", phone: "0484 234 5678" },
      notes: true,
      books: true,
      open: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves between tabs, each its own list, saying when one is empty", async () => {
    list.current = { data: [], isLoading: false, error: undefined };
    draw();
    expect(screen.getByText("No one is due back today")).toBeInTheDocument();
    for (const [tab, title, hint] of [
      ["Overdue 4", "Nothing overdue", "A visit’s follow-up day"],
      ["Upcoming 0", "No one is due in the next 30 days", "A visit’s follow-up day"],
      ["Lapsed 1", "No lapsed follow-ups", "Patients overdue for longer"],
      ["Completed 3", "No treatments completed in the last 30 days", "A treatment shows here"],
    ]) {
      await userEvent.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`^${hint}`))).toBeInTheDocument();
    }
    expect(list.asked).toHaveBeenLastCalledWith("COMPLETED");
  });

  it("says why it could not load", () => {
    list.current = { data: undefined, isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The follow-ups couldn't be loaded.")).toBeInTheDocument();
  });

  it("tells a doctor these are their patients; one who only reads neither notes nor books", () => {
    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    clinic.current = undefined;
    draw();
    expect(screen.getByText("Your patients")).toBeInTheDocument();
    expect(lastPanel()).toMatchObject({
      clinic: { name: auth.current.membership!.clinicName, phone: null },
      notes: false,
      books: false,
    });
  });

  it("in a view-only clinic, says why, and neither notes nor books", () => {
    const stub = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view", "visits.edit"] });
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    expect(lastPanel()).toMatchObject({ notes: false, books: false });
  });

  it("names no clinic before anyone is signed in", () => {
    auth.current = { ...authStub(), membership: null };
    clinic.current = undefined;
    draw();
    expect(lastPanel().clinic).toEqual({ name: "", phone: null });
  });
});
