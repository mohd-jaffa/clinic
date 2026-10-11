import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientPrefill } from "@/features/patients/prefill";
import type { Patient } from "@/features/patients/types";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { aPatient } from "@tests/support/patients";
import { Providers } from "@tests/support/providers";

const { auth, client, doctors, router } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { create: vi.fn(), update: vi.fn(), archive: vi.fn() },
  doctors: { current: [] as { id: string; name: string }[] },
  router: { replace: vi.fn(), push: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/api.client", () => ({ PatientsClient: client }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));
vi.mock("@/features/patients/hooks/usePatientMatches", () => ({ usePatientMatches: () => ({ data: [] }) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { PatientSheet } = await import("@/features/patients/components/PatientSheet");

const onClose = vi.fn();
const ASHA = { id: "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b", name: "Asha Menon" };
const RAHUL = { id: "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b", name: "Rahul Nair" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  auth.current = authStub();
  auth.current.membership = { ...auth.current.membership!, doctorId: ASHA.id };
  doctors.current = [ASHA, RAHUL];
  client.create.mockImplementation(async () => aPatient({ id: "p-1", number: 1012 }));
  client.update.mockImplementation(async ({ fullName }: { fullName?: string }) =>
    aPatient({ name: fullName ?? "Rohan Mehta" }),
  );
});
afterEach(() => vi.useRealTimers());

function Harness({ patient, prefill }: { patient?: Patient; prefill?: PatientPrefill }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <PatientSheet open={open} onClose={close} patient={patient} prefill={prefill} />;
}

const draw = (patient?: Patient, prefill?: PatientPrefill) =>
  render(
    <Providers>
      <Harness patient={patient} prefill={prefill} />
    </Providers>,
  );

const sheet = (name = "Add a patient") => screen.getByRole("dialog", { name });
const field = (name: RegExp, within_ = sheet()) => within(within_).getByRole("textbox", { name });
const radio = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
const doctor = (name?: string) => within(sheet(name)).getByRole("combobox", { name: /^Doctor/ });

async function fillRequired() {
  await userEvent.type(field(/^Full name/), "Rohan Mehta");
  await userEvent.type(field(/^Mobile/), "98765 43210");
  await userEvent.click(radio("Born", "Age"));
  await userEvent.type(field(/^Age in years/), "34");
  await userEvent.click(radio("Gender", "Male"));
}

describe("PatientSheet adding a patient (plan §10.1, D105 – D108)", () => {
  it("asks for what every patient needs, then adds them and opens their profile", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    expect(await screen.findByText("Full name needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Mobile needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Date of birth needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Choose gender.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();

    await fillRequired();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith({
        input: expect.objectContaining({
          fullName: "Rohan Mehta",
          phone: "98765 43210",
          born: { as: "AGE", date: "", years: "34" },
          gender: "MALE",
          assignedDoctorId: ASHA.id,
        }),
        key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );
    expect(router.replace).toHaveBeenCalledWith("/patients/p-1");
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain("Rohan Mehta added — P-1012");
  });

  it("sends the same add again with the same key, so a retry makes one patient", async () => {
    client.create.mockRejectedValueOnce(new ApiError(503, "EXTERNAL_SERVICE_ERROR", "No answer", "req_1"));
    draw();
    await fillRequired();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    expect(await screen.findByText("The patient wasn’t added")).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    await waitFor(() => expect(client.create).toHaveBeenCalledTimes(2));
    const [[first], [second]] = client.create.mock.calls as [[{ key: string }], [{ key: string }]];
    expect(second.key).toBe(first.key);
  });

  it("takes a date of birth from the calendar", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("button", { name: /^Date of birth/ }));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    await userEvent.type(field(/^Full name/), "Baby Mehta");
    await userEvent.type(field(/^Mobile/), "98765 43210");
    await userEvent.click(radio("Gender", "Female"));
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ born: { as: "DATE", date: "2026-10-03", years: "" } }),
        }),
      ),
    );
  });

  it("starts with the clinic's only doctor for staff, and with none when there are several (D108)", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "patients.create"] });
    auth.current.membership = { ...auth.current.membership!, doctorId: null };
    doctors.current = [RAHUL];
    const { unmount } = draw();
    expect(doctor()).toHaveTextContent("Rahul Nair");
    unmount();
    doctors.current = [ASHA, RAHUL];
    draw();
    expect(doctor()).toHaveTextContent("No doctor yet");
  });

  it("starts with what a search that found no one typed (D112)", () => {
    draw(undefined, { phone: "98765 43210" });
    expect(field(/^Mobile/)).toHaveValue("98765 43210");
    expect(field(/^Full name/)).toHaveValue("");
  });

  it("keeps the rest under More details, and opens it on a refusal inside (D105)", async () => {
    draw();
    const more = within(sheet()).getByRole("button", { name: "More details" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    await userEvent.type(field(/^Email/), "rohan");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Fewer details" }));
    await fillRequired();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add patient" }));
    expect(await screen.findByText("Email must look like name@example.com.")).toBeVisible();
    expect(within(sheet()).getByRole("button", { name: "Fewer details" })).toHaveAttribute("aria-expanded", "true");
    expect(client.create).not.toHaveBeenCalled();
  });
});

describe("PatientSheet changing a patient", () => {
  const rohan = aPatient({
    dateOfBirth: "1992-10-03",
    dobIsEstimated: true,
    email: "rohan@example.com",
    assignedDoctorId: RAHUL.id,
  });

  it("shows them as they are — an estimated birth as its age — with More details open when it holds any", () => {
    draw(rohan);
    const edit = sheet("Edit patient");
    expect(field(/^Full name/, edit)).toHaveValue("Rohan Mehta");
    expect(field(/^Mobile/, edit)).toHaveValue("98765 43210");
    expect(radio("Born", "Age")).toBeChecked();
    expect(field(/^Age in years/, edit)).toHaveValue("34");
    expect(radio("Gender", "Male")).toBeChecked();
    expect(within(edit).getByRole("button", { name: "Fewer details" })).toHaveAttribute("aria-expanded", "true");
    expect(field(/^Email/, edit)).toHaveValue("rohan@example.com");
    expect(screen.queryByText(/Already here/)).not.toBeInTheDocument();
  });

  it("sends only what was changed, so an untouched age moves no date", async () => {
    draw(rohan);
    await userEvent.clear(field(/^Full name/, sheet("Edit patient")));
    await userEvent.type(field(/^Full name/, sheet("Edit patient")), "Rohan M");
    await userEvent.click(within(sheet("Edit patient")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.update).toHaveBeenCalledWith({ id: "p-1", fullName: "Rohan M" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Rohan M saved");
  });

  it("closes without a word when nothing was changed, and says a refusal when one comes", async () => {
    const { unmount } = draw(aPatient({ assignedDoctorId: null }));
    expect(radio("Born", "Date of birth")).toBeChecked();
    await userEvent.click(within(sheet("Edit patient")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.update).not.toHaveBeenCalled();
    unmount();

    client.update.mockRejectedValueOnce(new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived.", "req_2"));
    draw(aPatient({ altPhone: "0484 234 5678", assignedDoctorId: RAHUL.id }));
    await userEvent.click(radio("Gender", "Other"));
    await userEvent.click(within(sheet("Edit patient")).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That wasn’t saved")).toBeInTheDocument();
    expect(client.update).toHaveBeenCalledWith({ id: "p-1", gender: "OTHER" });
  });

  it("archives them from the foot, once asked, and then closes (D122, D124)", async () => {
    client.archive.mockResolvedValue({ ...rohan, archivedAt: "2026-10-03T06:00:00Z" });
    draw(rohan);
    const edit = sheet("Edit patient");
    await userEvent.click(within(edit).getByRole("button", { name: "Archive" }));
    const ask = screen.getByRole("alertdialog", { name: "Archive Rohan Mehta?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(client.archive).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(within(edit).getByRole("button", { name: "Archive" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Archive Rohan Mehta?" })).getByRole("button", {
        name: "Archive",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.archive).toHaveBeenCalledWith("p-1");
    expect(client.update).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta archived");
  });

  it("offers no Archive to a patient being added", () => {
    draw();
    expect(within(sheet()).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("leaves an age blank when there is none to read, and doctors blank until they come", () => {
    doctors.current = undefined as unknown as typeof doctors.current;
    draw(aPatient({ dateOfBirth: "2027-01-01", dobIsEstimated: true, assignedDoctorId: null }));
    expect(field(/^Age in years/, sheet("Edit patient"))).toHaveValue("");
    expect(doctor("Edit patient")).toHaveTextContent("No doctor yet");
  });
});
