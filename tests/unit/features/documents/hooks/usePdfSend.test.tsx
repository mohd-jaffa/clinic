import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { getFile, saveFile, share } = vi.hoisted(() => ({
  getFile: vi.fn(),
  saveFile: vi.fn(),
  share: { sheet: false, shareFile: vi.fn(), openChat: vi.fn() },
}));
vi.mock("@/lib/api/client", async (actual) => ({ ...(await actual()), getFile }));
vi.mock("@/lib/download", () => ({ saveFile }));
vi.mock("@/lib/share", async (actual) => ({
  ...(await actual()),
  sharesFiles: () => share.sheet,
  shareFile: share.shareFile,
  openChat: share.openChat,
}));

const { usePdfSend } = await import("@/features/documents/hooks/usePdfSend");

const { bill: words } = UI_TEXT;
const NAME = "Rohan Mehta - Bill 2026-27-0042.pdf";
const TEXT = "Your bill 2026-27/0042 from Smile Care, 15 Oct: ₹1,500.";
const pdf = new Blob(["%PDF"], { type: "application/pdf" });

function Send() {
  const { send, sending } = usePdfSend(words, "BILL_PDF_FAILED");
  return (
    <button
      type="button"
      aria-busy={sending}
      onClick={() => void send({ pdf: "/api/bills/b-1/bill.pdf", name: NAME, phone: "+919876543210", text: TEXT })}
    >
      WhatsApp
    </button>
  );
}

const tap = () => userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

beforeEach(() => {
  vi.clearAllMocks();
  share.sheet = false;
  getFile.mockResolvedValue(pdf);
});

describe("usePdfSend (plan §22.1; D245, D246, D327)", () => {
  it("on a desktop opens the chat as the tap lands, then downloads the PDF to attach, in the document's own words", async () => {
    render(<Send />, { wrapper: Providers });
    await tap();
    expect(share.openChat).toHaveBeenCalledWith("+919876543210", TEXT);
    expect(getFile).toHaveBeenCalledWith("/api/bills/b-1/bill.pdf?download=1");
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(pdf, NAME));
    expect((await screen.findAllByText(words.attachTitle))[0]).toBeInTheDocument();
    expect(screen.getAllByText(words.attachBody(NAME))[0]).toBeInTheDocument();
  });

  it("on a phone hands the file and the message to the share sheet, and says so", async () => {
    share.sheet = true;
    share.shareFile.mockResolvedValue(true);
    render(<Send />, { wrapper: Providers });
    await tap();
    await waitFor(() => expect(share.shareFile).toHaveBeenCalled());
    const [file, text] = share.shareFile.mock.calls[0] as [File, string];
    expect([file.name, file.type, text]).toEqual([NAME, "application/pdf", TEXT]);
    expect(share.openChat).not.toHaveBeenCalled();
    expect((await screen.findAllByText(words.shared))[0]).toBeInTheDocument();
  });

  it("says, in the document's words, when its PDF could not be made", async () => {
    getFile.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", ERROR_MESSAGES.BILL_PDF_FAILED));
    render(<Send />, { wrapper: Providers });
    await tap();
    expect(await screen.findByRole("alertdialog", { name: words.notSent })).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
  });
});
