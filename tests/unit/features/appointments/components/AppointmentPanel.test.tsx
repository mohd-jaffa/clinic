import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aCalendarAppointment, anAppointmentDetail } from "@tests/support/appointments";

const detail = anAppointmentDetail({ notes: "First visit" });

interface Stub {
  open: boolean;
  onClose: () => void;
}
const stub = (name: string, done?: "onDone" | "onMoved") =>
  function Sheet(props: Stub & Record<string, unknown>) {
    if (!props.open) return null;
    return (
      <div role="dialog" aria-label={name}>
        <button type="button" onClick={props.onClose}>
          Back
        </button>
        {done && (
          <button type="button" onClick={props[done] as () => void}>
            Done
          </button>
        )}
      </div>
    );
  };

vi.mock("@/features/appointments/components/AppointmentSheet", () => ({
  AppointmentSheet: (props: Stub & Record<string, (value?: unknown) => void> & { linkProfile: boolean }) =>
    props.open ? (
      <div role="dialog" aria-label={`Detail${props.linkProfile ? ", with profile" : ""}`}>
        <button type="button" onClick={() => props.onReschedule(detail)}>
          Reschedule
        </button>
        <button type="button" onClick={() => props.onEditNotes(detail)}>
          Edit notes
        </button>
        <button type="button" onClick={() => props.onTakeVitals(detail)}>
          Vitals
        </button>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel appointment
        </button>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/appointments/components/CancelSheet", () => ({ CancelSheet: stub("Cancel", "onDone") }));
vi.mock("@/features/appointments/components/NotesSheet", () => ({ NotesSheet: stub("Notes", "onDone") }));
vi.mock("@/features/appointments/components/BookingSheet", () => ({ BookingSheet: stub("Reschedule", "onMoved") }));
vi.mock("@/features/visits/components/WaitingVitalsSheet", () => ({ WaitingVitalsSheet: stub("Vitals", "onDone") }));

const { AppointmentPanel } = await import("@/features/appointments/components/AppointmentPanel");

const onClose = vi.fn();
beforeEach(() => vi.clearAllMocks());

const draw = (linkProfile?: boolean) =>
  render(<AppointmentPanel appointment={aCalendarAppointment()} open onClose={onClose} linkProfile={linkProfile} />);
const only = () => screen.getAllByRole("dialog").map((dialog) => dialog.getAttribute("aria-label"));

describe("AppointmentPanel (D160 – D165)", () => {
  it("opens the detail, with Open profile unless asked not to", () => {
    const { unmount } = draw();
    expect(only()).toEqual(["Detail, with profile"]);
    unmount();
    draw(false);
    expect(only()).toEqual(["Detail"]);
  });

  it("opens each action's sheet in the detail's place, and goes back to it on closing", async () => {
    draw();
    for (const action of ["Reschedule", "Edit notes", "Vitals", "Cancel appointment"]) {
      await userEvent.click(screen.getByRole("button", { name: action }));
      expect(only()).toEqual([
        { Reschedule: "Reschedule", "Edit notes": "Notes", Vitals: "Vitals", "Cancel appointment": "Cancel" }[action],
      ]);
      await userEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(only()).toEqual(["Detail, with profile"]);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes everything once an action is done, or the detail is closed", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    // A waiting patient's vitals saved (D203): everything closes too.
    await userEvent.click(screen.getByRole("button", { name: "Vitals" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(only()).toEqual(["Detail, with profile"]);
  });

  it("is nothing while no appointment has been opened", () => {
    const { container } = render(<AppointmentPanel appointment={null} open={false} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
  });
});
