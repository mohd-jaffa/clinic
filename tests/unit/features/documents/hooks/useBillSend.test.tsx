import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import { authStub } from "@tests/support/auth";

const { auth, pdfSend, asked } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  pdfSend: { send: vi.fn(), sending: false },
  asked: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/documents/hooks/usePdfSend", () => ({
  usePdfSend: (...args: unknown[]) => {
    asked(...args);
    return pdfSend;
  },
}));

const { useBillSend } = await import("@/features/documents/hooks/useBillSend");

const bill = {
  billId: "b-1",
  number: "2026-27/0042",
  day: "2026-10-15",
  patient: "Rohan Mehta",
  phone: "+919876543210",
  totalPaise: 150_000,
  duePaise: 100_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-20T06:00:00Z"), toFake: ["Date"] });
  auth.current = authStub();
});

describe("useBillSend (plan §22.1; D327, D341)", () => {
  it("sends the bill's PDF with its number, day, total and what is still due, in the bill's own words", () => {
    const { result } = renderHook(() => useBillSend());
    expect(asked).toHaveBeenCalledWith(UI_TEXT.bill, "BILL_PDF_FAILED");
    void result.current.send(bill);
    expect(pdfSend.send).toHaveBeenCalledWith({
      pdf: "/api/bills/b-1/bill.pdf",
      name: "Rohan Mehta - Bill 2026-27-0042.pdf",
      phone: "+919876543210",
      text: "Your bill 2026-27/0042 from Smile Care, 15 Oct: ₹1,500. ₹1,000 is due.",
    });
  });

  it("says nothing of a due once it is paid, and names no clinic for someone with none", () => {
    auth.current = { ...authStub(), membership: null };
    const { result } = renderHook(() => useBillSend());
    void result.current.send({ ...bill, duePaise: 0 });
    expect(pdfSend.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Your bill 2026-27/0042 from , 15 Oct: ₹1,500." }),
    );
    expect(result.current.sending).toBe(false);
  });
});
