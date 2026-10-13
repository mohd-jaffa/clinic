import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAlert } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, query, client, sheet, refresh } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  query: { current: {} as Record<string, unknown>, asked: vi.fn() },
  client: { update: vi.fn() },
  sheet: { alert: undefined as PatientAlert | undefined, also: undefined as readonly string[] | undefined },
  refresh: vi.fn<(routes: readonly string[]) => Promise<void>>(async () => undefined),
}));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/api.client", () => ({ AlertsClient: client }));
vi.mock("@/features/patients/hooks/useAlerts", () => ({
  useAlerts: (patientId: string, mayRead: boolean) => {
    query.asked(patientId, mayRead);
    return query.current;
  },
}));
vi.mock("@/features/patients/components/AlertSheet", () => ({
  AlertSheet: ({
    open,
    onClose,
    alert,
    also,
  }: {
    open: boolean;
    onClose: () => void;
    alert?: PatientAlert;
    also?: readonly string[];
  }) => {
    sheet.alert = alert;
    sheet.also = also;
    return open ? (
      <div role="dialog" aria-label={alert ? `Edit ${alert.label}` : "Add an alert"}>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
    ) : null;
  },
}));

const { PatientAlerts, VisitAlerts } = await import("@/features/patients/components/PatientAlerts");

const alert = (overrides: Partial<PatientAlert>): PatientAlert => ({
  id: "a-1",
  kind: "ALLERGY",
  label: "Penicillin",
  note: null,
  active: true,
  ...overrides,
});
const ALERTS = [
  alert({ id: "a-1", kind: "MEDICATION", label: "Metformin 500 mg", note: "Twice a day" }),
  alert({ id: "a-2", kind: "ALLERGY", label: "Penicillin", note: "Rash, 2019" }),
  alert({ id: "a-3", kind: "CONDITION", label: "Type 2 diabetes" }),
  alert({ id: "a-4", kind: "ALLERGY", label: "Ibuprofen", active: false }),
  alert({ id: "a-5", kind: "ALLERGY", label: "Peanuts" }),
];

const draw = (patient = aPatient()) =>
  render(
    <Providers>
      <PatientAlerts patient={patient} />
    </Providers>,
  );

const openSheet = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Alerts" }));
  return screen.getByRole("dialog", { name: "Alerts" });
};
const rows = (within_: HTMLElement) =>
  within(within(within_).getAllByRole("list", { name: "Alerts" })[0])
    .getAllByRole("listitem")
    .map((row) => row.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: ALERTS, isLoading: false };
  sheet.alert = undefined;
  sheet.also = undefined;
  client.update.mockImplementation(async ({ alertId }: { alertId: string }) => ({
    ...ALERTS.find(({ id }) => id === alertId)!,
    active: false,
  }));
});

describe("PatientAlerts in the header (plan §10.3, D117)", () => {
  it("shows each active alert, allergies first, saying what each is to a screen reader", () => {
    draw();
    expect(query.asked).toHaveBeenCalledWith("p-1", true);
    const chips = within(screen.getByRole("list", { name: "Alerts" })).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Allergy: Penicillin",
      "Allergy: Peanuts",
      "Condition: Type 2 diabetes",
      "Medication: Metformin 500 mg",
    ]);
  });

  it("says when there are none, and when they couldn't be loaded", () => {
    query.current = { data: [alert({ active: false })], isLoading: false };
    const { unmount } = draw();
    expect(screen.getByText("No alerts")).toBeInTheDocument();
    unmount();
    query.current = { data: undefined, isLoading: false, error: new Error("offline") };
    draw();
    // In the header; the closed sheet holds its own way to try again.
    expect(screen.getByText("The alerts couldn't be loaded.", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("No alerts")).not.toBeInTheDocument();
  });

  it("is not there for someone who may not read visits, nor for someone with no clinic", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view"] });
    const { unmount } = draw();
    expect(query.asked).toHaveBeenCalledWith("p-1", false);
    expect(screen.queryByRole("button", { name: "Alerts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Alerts" })).not.toBeInTheDocument();
    unmount();
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: "Alerts" })).not.toBeInTheDocument();
  });
});

describe("PatientAlerts' sheet (D117 – D120)", () => {
  it("lists each active alert with its kind and note, and folds the turned-off ones", async () => {
    draw();
    const alerts = await openSheet();
    expect(rows(alerts)).toEqual([
      "PenicillinAllergy · Rash, 2019",
      "PeanutsAllergy",
      "Type 2 diabetesCondition",
      "Metformin 500 mgMedication · Twice a day",
    ]);
    await userEvent.click(within(alerts).getByRole("button", { name: "Show turned off (1)" }));
    expect(within(within(alerts).getByRole("list", { name: "Turned off" })).getByText("Ibuprofen")).toBeVisible();
  });

  it("opens the add sheet, and the add sheet on an alert to change it", async () => {
    draw();
    const alerts = await openSheet();
    await userEvent.click(within(alerts).getByRole("button", { name: "Add alert" }));
    expect(screen.getByRole("dialog", { name: "Add an alert" })).toBeInTheDocument();
    expect(sheet.alert).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Add an alert" })).not.toBeInTheDocument();
    await userEvent.click(within(alerts).getByRole("button", { name: "Edit Peanuts" }));
    expect(screen.getByRole("dialog", { name: "Edit Peanuts" })).toBeInTheDocument();
    expect(sheet.alert).toMatchObject({ id: "a-5" });
  });

  it("closes", async () => {
    draw();
    const alerts = await openSheet();
    await userEvent.click(within(alerts).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Alerts" })).not.toBeInTheDocument();
  });

  it("turns an alert off only once it is confirmed, and says so", async () => {
    draw();
    const alerts = await openSheet();
    await userEvent.click(within(alerts).getByRole("button", { name: "Turn off Peanuts" }));
    const ask = screen.getByRole("alertdialog", { name: "Turn off Peanuts?" });
    expect(ask).toHaveTextContent("It stops showing on the profile, at visits and on prescriptions.");
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(client.update).not.toHaveBeenCalled();

    await userEvent.click(within(alerts).getByRole("button", { name: "Turn off Peanuts" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Turn off Peanuts?" })).getByRole("button", { name: "Turn off" }),
    );
    await waitFor(() =>
      expect(client.update).toHaveBeenCalledWith({ patientId: "p-1", alertId: "a-5", active: false }),
    );
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain("Peanuts turned off");
  });

  it("says when turning one off was refused", async () => {
    client.update.mockRejectedValueOnce(new ApiError(503, "EXTERNAL_SERVICE_ERROR", "No answer", "req_1"));
    draw();
    const alerts = await openSheet();
    await userEvent.click(within(alerts).getByRole("button", { name: "Turn off Penicillin" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Turn off Penicillin?" })).getByRole("button", {
        name: "Turn off",
      }),
    );
    expect(await screen.findByText("That wasn’t turned off")).toBeInTheDocument();
  });

  it("says when the patient has none yet", async () => {
    query.current = { data: [], isLoading: false };
    draw();
    const alerts = await openSheet();
    expect(within(alerts).getByRole("heading", { name: "No alerts yet" })).toBeInTheDocument();
    expect(within(alerts).queryByRole("button", { name: /^Show turned off/ })).not.toBeInTheDocument();
  });

  it("says when they couldn't be loaded, and tries again", async () => {
    const mutate = vi.fn();
    query.current = { data: undefined, isLoading: false, error: new Error("offline"), mutate };
    draw();
    const alerts = await openSheet();
    expect(within(alerts).getByRole("alert")).toHaveTextContent("The alerts couldn't be loaded.");
    await userEvent.click(within(alerts).getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("is read only for someone who may only read visits", async () => {
    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    draw();
    const alerts = await openSheet();
    expect(rows(alerts)).toHaveLength(4);
    expect(within(alerts).queryByRole("button", { name: /^(Edit|Turn off|Add alert)/ })).not.toBeInTheDocument();
    expect(within(alerts).queryByText("Your clinic is view-only until its plan is renewed.")).not.toBeInTheDocument();
  });

  it("changes nothing in a view-only clinic, and says why", async () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    const alerts = await openSheet();
    expect(within(alerts).getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    expect(within(alerts).queryByRole("button", { name: /^(Edit|Turn off|Add alert)/ })).not.toBeInTheDocument();
  });

  it("changes nothing of an archived patient's (D103)", async () => {
    draw(aPatient({ archivedAt: "2026-10-01T05:00:00Z" }));
    const alerts = await openSheet();
    expect(within(alerts).queryByRole("button", { name: /^(Edit|Turn off|Add alert)/ })).not.toBeInTheDocument();
  });
});

describe("VisitAlerts on a visit (D207)", () => {
  const VISIT = "/api/visits/v-1";
  const drawOnVisit = (archived = false) =>
    render(
      <Providers>
        <VisitAlerts patientId="p-1" archived={archived} visitRoute={VISIT} />
      </Providers>,
    );
  const button = () => screen.getByRole("button", { name: "Alerts" });

  it("reads the alerts only once the sheet is first opened, and keeps them read once it is closed", async () => {
    drawOnVisit();
    expect(query.asked).toHaveBeenLastCalledWith("p-1", false);
    expect(button().querySelector(".lucide-pencil")).not.toBeNull();
    const alerts = await openSheet();
    expect(query.asked).toHaveBeenLastCalledWith("p-1", true);
    expect(rows(alerts)).toHaveLength(4);
    await userEvent.click(within(alerts).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Alerts" })).not.toBeInTheDocument();
    expect(query.asked).toHaveBeenLastCalledWith("p-1", true);
  });

  it("makes the visit stale too when one is turned off, and hands it to the add sheet", async () => {
    drawOnVisit();
    const alerts = await openSheet();
    await userEvent.click(within(alerts).getByRole("button", { name: "Turn off Peanuts" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Turn off Peanuts?" })).getByRole("button", { name: "Turn off" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledWith(["/api/patients/p-1/alerts", VISIT]));
    await userEvent.click(within(alerts).getByRole("button", { name: "Add alert" }));
    expect(screen.getByRole("dialog", { name: "Add an alert" })).toBeInTheDocument();
    expect(sheet.also).toEqual([VISIT]);
  });

  it("only shows them — an eye, nothing to change — to someone who may only read, for an archived patient, and in a view-only clinic", async () => {
    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    const { unmount } = drawOnVisit();
    expect(button().querySelector(".lucide-eye")).not.toBeNull();
    let alerts = await openSheet();
    expect(within(alerts).queryByRole("button", { name: /^(Edit|Turn off|Add alert)/ })).not.toBeInTheDocument();
    unmount();

    auth.current = authStub();
    const archived = drawOnVisit(true);
    alerts = await openSheet();
    expect(within(alerts).queryByRole("button", { name: /^(Edit|Turn off|Add alert)/ })).not.toBeInTheDocument();
    archived.unmount();

    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    const viewOnly = drawOnVisit();
    alerts = await openSheet();
    expect(within(alerts).getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    viewOnly.unmount();

    auth.current = { ...authStub(), membership: null };
    drawOnVisit();
    expect(button().querySelector(".lucide-eye")).not.toBeNull();
  });
});
