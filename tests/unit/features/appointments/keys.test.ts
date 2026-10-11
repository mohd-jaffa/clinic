import { describe, expect, it } from "vitest";

import { appointmentRoutes, calendarKey } from "@/features/appointments/keys";

describe("calendarKey", () => {
  it("names the days and the doctor — none for every doctor", () => {
    expect(calendarKey("2026-10-13", "2026-10-13", "")).toBe("/api/appointments?from=2026-10-13&to=2026-10-13");
    expect(calendarKey("2026-10-12", "2026-10-18", "d-1")).toBe(
      "/api/appointments?from=2026-10-12&to=2026-10-18&doctorId=d-1",
    );
  });
});

describe("appointmentRoutes", () => {
  it("names every read a change to an appointment makes stale", () => {
    expect(appointmentRoutes({ id: "a-1", patientId: "p-1" })).toEqual([
      "/api/appointments",
      "/api/appointments/booked",
      "/api/appointments/a-1",
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
    ]);
  });
});
