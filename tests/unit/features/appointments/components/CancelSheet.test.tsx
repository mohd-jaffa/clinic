import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aCalendarAppointment } from "@tests/support/appointments";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { setStatus: vi.fn() } }));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));

const { CancelSheet } = await import("@/features/appointments/components/CancelSheet");

const onClose = vi.fn();
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.setStatus.mockResolvedValue({ id: "a-1", status: "CANCELLED" });
});

const draw = (appointment = aCalendarAppointment()) =>
  render(
    <Providers>
      <CancelSheet appointment={appointment} open onClose={onClose} onDone={onDone} />
    </Providers>,
  );
const sheet = () => screen.getByRole("dialog", { name: "Cancel the appointment" });
const submit = () => userEvent.click(within(sheet()).getByRole("button", { name: "Cancel appointment" }));
const ask = () => screen.getByRole("alertdialog", { name: "Cancel Rohan Mehta’s appointment?" });

describe("CancelSheet (D162)", () => {
  it("takes a quick reason, asks first on the coral card, then cancels — closing everything with a card", async () => {
    draw();
    expect(within(sheet()).getByText("Tuesday, 13 Oct 2026 · 9:00 AM – 9:15 AM")).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Patient asked" }));
    await submit();
    expect(ask()).toHaveTextContent("13 Oct, 9:00 AM with Maya Rao. Reason: Patient asked.");
    await userEvent.click(within(ask()).getByRole("button", { name: "Cancel appointment" }));
    expect(client.setStatus).toHaveBeenCalledWith({ id: "a-1", status: "CANCELLED", reason: "Patient asked" });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await screen.findAllByText("Cancelled Rohan Mehta · 13 Oct, 9:00 AM")).length).toBeGreaterThan(0);
  });

  it("asks why, and for Other's reason to be typed — then sends it", async () => {
    draw(aCalendarAppointment({ doctorName: null }));
    await submit();
    expect(within(sheet()).getByText("Choose why.")).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Other" }));
    await submit();
    expect(within(sheet()).getByText("Reason needs a value.")).toBeInTheDocument();
    await userEvent.type(within(sheet()).getByRole("textbox", { name: /^Reason/ }), "Moved to Kochi");
    await submit();
    expect(ask()).toHaveTextContent("with No longer on the team. Reason: Moved to Kochi.");
    await userEvent.click(within(ask()).getByRole("button", { name: "Cancel appointment" }));
    expect(client.setStatus).toHaveBeenCalledWith({ id: "a-1", status: "CANCELLED", reason: "Moved to Kochi" });
  });

  it("keeps it when Keep it is chosen", async () => {
    draw();
    await userEvent.click(within(sheet()).getByRole("radio", { name: "Clinic closed" }));
    await submit();
    await userEvent.click(within(ask()).getByRole("button", { name: "Keep it" }));
    expect(client.setStatus).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
