import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aQueueAppointment } from "@tests/support/appointments";
import { Providers } from "@tests/support/providers";

const { client, router } = vi.hoisted(() => ({
  client: {
    sendIn: vi.fn(),
    done: vi.fn(),
    next: vi.fn(),
    backToWaiting: vi.fn(),
    stepOut: vi.fn(),
  },
  router: { push: vi.fn() },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { useBackToWaiting, useDone, useNextPatient, useSendIn, useStepOut } =
  await import("@/features/appointments/hooks/useQueueMoves");

const asha = aQueueAppointment({ id: "a-1", patientName: "Asha Iyer", status: "ARRIVED", token: 4 });
const rahul = aQueueAppointment({ id: "a-2", patientName: "Rahul Mehta", status: "IN_PROGRESS" });
const meena = aQueueAppointment({ id: "a-3", patientName: "Meena Iyer", status: "IN_PROGRESS" });
const elsewhere = aQueueAppointment({ id: "a-4", doctorId: "d-2", status: "IN_PROGRESS" });

function SendIn({ inRoom }: { inRoom?: Parameters<typeof useSendIn>[1] }) {
  const { sendIn, sending } = useSendIn(asha, inRoom);
  return (
    <button type="button" disabled={sending} onClick={() => void sendIn()}>
      Send in
    </button>
  );
}

function InRoom({ fromVisit = false, named = true }: { fromVisit?: boolean; named?: boolean }) {
  const { done } = useDone({ ...rahul, visitId: "v-2" });
  const { next } = useNextPatient({
    doctorId: "d-1",
    doctorName: "Maya Rao",
    appointment: named ? { ...rahul, visitId: "v-2" } : undefined,
    fromVisit,
  });
  const { backToWaiting } = useBackToWaiting(rahul);
  return (
    <>
      <button type="button" onClick={() => void done()}>
        Done
      </button>
      <button type="button" onClick={() => void next()}>
        Next
      </button>
      <button type="button" onClick={() => void backToWaiting()}>
        Back to waiting
      </button>
    </>
  );
}

function Away() {
  const { stepOut, stepBack } = useStepOut(asha);
  return (
    <>
      <button type="button" onClick={() => void stepOut()}>
        Out
      </button>
      <button type="button" onClick={() => void stepBack()}>
        Back
      </button>
    </>
  );
}

const card = (name: string | RegExp) => screen.findByRole("alertdialog", { name });
/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];

beforeEach(() => {
  vi.clearAllMocks();
  client.sendIn.mockResolvedValue({ visitId: "v-1" });
  client.done.mockResolvedValue({ appointmentId: "a-2" });
  client.backToWaiting.mockResolvedValue({ appointmentId: "a-2" });
});

describe("useSendIn (D192)", () => {
  it("sends in at once while the doctor's room is free — another doctor's patient in does not count", async () => {
    render(<SendIn inRoom={{ inRoom: [elsewhere] }} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    expect(client.sendIn).toHaveBeenCalledWith({ appointmentId: "a-1" });
    expect(await notice("Asha Iyer is in with Maya Rao")).toBeInTheDocument();
  });

  it("asks first while the doctor has someone in: mark them done and send in", async () => {
    render(<SendIn inRoom={{ inRoom: [rahul, meena] }} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    const asked = await card("Rahul Mehta and Meena Iyer are still with Maya Rao");
    await userEvent.click(within(asked).getByRole("button", { name: "Mark done and send in" }));
    expect(client.sendIn).toHaveBeenCalledWith({ appointmentId: "a-1", others: "FINISH" });
  });

  it("keeps both in for a second chair, or sends no one when told no", async () => {
    render(<SendIn inRoom={{ inRoom: [rahul] }} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    await userEvent.click(
      within(await card("Rahul Mehta is still with Maya Rao")).getByRole("button", { name: "Keep both in" }),
    );
    expect(client.sendIn).toHaveBeenCalledWith({ appointmentId: "a-1", others: "KEEP" });

    client.sendIn.mockClear();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    await userEvent.click(within(await card(/still with/)).getByRole("button", { name: "Cancel" }));
    expect(client.sendIn).not.toHaveBeenCalled();
  });

  it("asks once refused because another desk sent someone in meanwhile, then sends in as told", async () => {
    client.sendIn
      .mockRejectedValueOnce(new ApiError(409, "DOCTOR_ROOM_TAKEN", "Someone else is now with this doctor."))
      .mockResolvedValueOnce({ visitId: "v-1" });
    render(<SendIn />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    await userEvent.click(
      within(await card("Someone is still with Maya Rao")).getByRole("button", { name: "Keep both in" }),
    );
    await waitFor(() => expect(client.sendIn).toHaveBeenLastCalledWith({ appointmentId: "a-1", others: "KEEP" }));
  });

  it("asks once refused, and sends no one when told no then", async () => {
    client.sendIn.mockRejectedValueOnce(new ApiError(409, "DOCTOR_ROOM_TAKEN", "Taken."));
    render(<SendIn />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    await userEvent.click(within(await card("Someone is still with Maya Rao")).getByRole("button", { name: "Cancel" }));
    expect(client.sendIn).toHaveBeenCalledTimes(1);
  });

  it("says why any other refusal happened", async () => {
    client.sendIn.mockRejectedValueOnce(new ApiError(422, "PATIENT_ARCHIVED", "This patient is archived."));
    render(<SendIn />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    expect(await card("They weren’t sent in")).toHaveTextContent("This patient is archived.");
  });
});

describe("useDone, useBackToWaiting (D43, D197)", () => {
  it("marks the patient done, or back to waiting, and the card says so", async () => {
    render(<InRoom />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(client.done).toHaveBeenCalledWith("a-2");
    expect(await notice("Rahul Mehta is done")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to waiting" }));
    expect(client.backToWaiting).toHaveBeenCalledWith("a-2");
    expect(await notice("Rahul Mehta is waiting again")).toBeInTheDocument();
  });

  it("says why they were refused", async () => {
    client.done.mockRejectedValueOnce(new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "Refresh."));
    client.backToWaiting.mockRejectedValueOnce(new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "Refresh."));
    render(<InRoom />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(within(await card("That wasn’t marked done")).getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Back to waiting" }));
    expect(await card("The queue didn’t move")).toBeInTheDocument();
  });
});

describe("useNextPatient (D194, D196)", () => {
  it("from the queue, says who is in and stays", async () => {
    client.next.mockResolvedValue({
      sent: { appointmentId: "a-5", visitId: "v-5", token: 8, patientName: "Isha Roy" },
    });
    render(<InRoom />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: "a-2" });
    expect(await notice("Isha Roy is in with Maya Rao")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("from the visit, opens the next patient's visit", async () => {
    client.next.mockResolvedValue({
      sent: { appointmentId: "a-5", visitId: "v-5", token: 8, patientName: "Isha Roy" },
    });
    render(<InRoom fromVisit />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/visits/v-5"));
  });

  it("from the visit, goes back to the queue when no one is waiting", async () => {
    client.next.mockResolvedValue({ sent: null });
    render(<InRoom fromVisit />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await notice("No one is waiting")).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/queue");
  });

  it("with the room free, asks for no one by name; says no one is waiting from the queue without leaving", async () => {
    client.next.mockResolvedValue({ sent: null });
    render(<InRoom named={false} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: undefined });
    expect(await notice("No one is waiting")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("names a doctor gone from the team on its card", async () => {
    client.next.mockResolvedValue({
      sent: { appointmentId: "a-5", visitId: "v-5", token: 8, patientName: "Isha Roy" },
    });
    function Gone() {
      const { next } = useNextPatient({ doctorId: "d-1", doctorName: null });
      return (
        <button type="button" onClick={() => void next()}>
          Next
        </button>
      );
    }
    render(<Gone />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await notice("Isha Roy is in with No longer on the team")).toBeInTheDocument();
  });

  it("says why it was refused", async () => {
    client.next.mockRejectedValue(new ApiError(403, "AUTH_PERMISSION_DENIED", "Not allowed."));
    render(<InRoom />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await card("The queue didn’t move")).toHaveTextContent("Not allowed.");
  });
});

describe("useStepOut (D198)", () => {
  it("marks a patient stepped out and back, the card saying which", async () => {
    client.stepOut.mockResolvedValueOnce({ steppedOutAt: "2026-10-13T05:00:00Z" });
    render(<Away />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Out" }));
    expect(client.stepOut).toHaveBeenCalledWith({ appointmentId: "a-1", out: true });
    expect(await notice("Asha Iyer stepped out")).toBeInTheDocument();

    client.stepOut.mockResolvedValueOnce({ steppedOutAt: null });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(client.stepOut).toHaveBeenLastCalledWith({ appointmentId: "a-1", out: false });
    expect(await notice("Asha Iyer is back")).toBeInTheDocument();
  });

  it("says why it was refused", async () => {
    client.stepOut.mockRejectedValue(new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "Refresh."));
    render(<Away />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Out" }));
    expect(await card("The queue didn’t move")).toBeInTheDocument();
  });
});
