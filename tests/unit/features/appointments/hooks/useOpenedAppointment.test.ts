import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOpenedAppointment } from "@/features/appointments/hooks/useOpenedAppointment";
import { aCalendarAppointment } from "@tests/support/appointments";

describe("useOpenedAppointment (D160)", () => {
  it("opens an appointment, and keeps it once closed for its sheet to show as it goes", () => {
    const { result } = renderHook(() => useOpenedAppointment());
    expect(result.current).toMatchObject({ appointment: null, open: false });
    const rohan = aCalendarAppointment();
    act(() => result.current.show(rohan));
    expect(result.current).toMatchObject({ appointment: rohan, open: true });
    act(() => result.current.close());
    expect(result.current).toMatchObject({ appointment: rohan, open: false });
  });
});
