import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aCalendarAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth } = vi.hoisted(() => ({
  client: { remind: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { RemindButton } = await import("@/features/appointments/components/RemindButton");

const REMINDER =
  "https://wa.me/919876543210?text=" +
  encodeURIComponent("Reminder: your appointment with Dr. Maya Rao at Smile Care on Tue 13 Oct, 9:00 AM.");

beforeEach(() => {
  vi.clearAllMocks();
  const signedIn = authStub({ role: "STAFF", permissions: ["appointments.view", "appointments.edit"] });
  auth.current = { ...signedIn, membership: { ...signedIn.membership!, clinicName: "Smile Care" } };
  client.remind.mockResolvedValue({ remindedAt: "2026-10-12T05:00:00Z" });
});

const draw = (look: "capsule" | "icon") =>
  render(
    <Providers>
      <RemindButton appointment={aCalendarAppointment()} look={look} />
    </Providers>,
  );
/** Follows the link as a tap would, without leaving the test's page. */
const follow = async (link: HTMLElement) => {
  link.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(link);
};

describe("RemindButton (plan §22.1; D179 – D182)", () => {
  it("opens WhatsApp on the patient's mobile with the reminder written, and notes it as it opens", async () => {
    draw("icon");
    const link = screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" });
    expect(link).toHaveAttribute("href", REMINDER);
    expect(link).toHaveAttribute("target", "_blank");
    await follow(link);
    expect(client.remind).toHaveBeenCalledWith("a-1");
  });

  it("is a capsule in the detail, saying what it does", async () => {
    draw("capsule");
    const link = screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" });
    expect(link).toHaveTextContent("Remind on WhatsApp");
    expect(link).toHaveAttribute("href", REMINDER);
  });

  it("still opens in a view-only clinic, and notes nothing (D181)", async () => {
    const viewOnly = auth.current;
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw("icon");
    await follow(screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" }));
    expect(client.remind).not.toHaveBeenCalled();
  });

  it("says when the reminder could not be noted", async () => {
    client.remind.mockRejectedValue(new ApiError(422, "APPOINTMENT_NOT_REMINDABLE", "Only a booking.", "req_1"));
    draw("icon");
    await follow(screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" }));
    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "The reminder wasn’t noted" })).toHaveTextContent(
        "Only a booking.",
      ),
    );
  });

  it("writes no clinic for someone with no membership", () => {
    auth.current = { ...auth.current, membership: null };
    draw("icon");
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("Dr. Maya Rao at  on")),
    );
  });
});
