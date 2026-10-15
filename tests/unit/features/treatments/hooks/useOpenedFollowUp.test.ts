import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOpenedFollowUp } from "@/features/treatments/hooks/useOpenedFollowUp";
import type { FollowUp } from "@/features/treatments/types";
import { aFollowUp } from "@tests/support/treatments";

describe("useOpenedFollowUp (plan §14.3)", () => {
  it("opens one, follows it as the list is read again, and keeps it once it leaves the list or closes", () => {
    const reminded = { outcome: "REMINDER_SENT" as const, at: "2026-10-15T05:00:00Z", note: null, by: "Priya Shah" };
    let list: FollowUp[] = [aFollowUp()];
    const { result, rerender } = renderHook(() => useOpenedFollowUp(list));
    expect(result.current).toMatchObject({ followUp: null, open: false });
    act(() => result.current.show(aFollowUp()));
    expect(result.current).toMatchObject({ followUp: { lastContact: null }, open: true });
    list = [aFollowUp({ lastContact: reminded })];
    rerender();
    expect(result.current.followUp?.lastContact).toEqual(reminded);
    list = [];
    rerender();
    expect(result.current.followUp?.lastContact).toBeNull();
    act(() => result.current.close());
    expect(result.current).toMatchObject({ followUp: { id: "t-1" }, open: false });
  });
});
