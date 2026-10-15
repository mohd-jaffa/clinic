import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { getFile, saveFile, share, auth } = vi.hoisted(() => ({
  getFile: vi.fn(),
  saveFile: vi.fn(),
  share: { sheet: true, shareFile: vi.fn(), openChat: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
}));
vi.mock("@/lib/api/client", async (actual) => ({ ...(await actual()), getFile }));
vi.mock("@/lib/download", () => ({ saveFile }));
vi.mock("@/lib/share", async (actual) => ({
  ...(await actual()),
  sharesFiles: () => share.sheet,
  shareFile: share.shareFile,
  openChat: share.openChat,
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { usePrescriptionSend } = await import("@/features/documents/hooks/usePrescriptionSend");

const { prescription: words } = UI_TEXT;
const NAME = "Rohan Mehta - 14 Oct 2025 - Prescription.pdf";
const TEXT = "Your prescription from Dr. Maya Rao, Smile Care, 14 Oct 2025.";
const pdf = new Blob(["%PDF"], { type: "application/pdf" });

function Send({ doctor = "Maya Rao" }: { doctor?: string | null }) {
  const { send, sending } = usePrescriptionSend({
    visitId: "v-1",
    patient: "Rohan Mehta",
    phone: "+919876543210",
    day: "2025-10-14",
    doctor,
  });
  return (
    <button type="button" aria-busy={sending} onClick={() => void send()}>
      WhatsApp
    </button>
  );
}

const draw = (doctor?: string | null) => render(<Send doctor={doctor} />, { wrapper: Providers });
const tap = () => userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];

beforeEach(() => {
  vi.clearAllMocks();
  share.sheet = true;
  auth.current = authStub();
  getFile.mockResolvedValue(pdf);
});

describe("usePrescriptionSend on a phone (D245)", () => {
  it("hands the PDF, under its name, and the message to the share sheet, and says so", async () => {
    share.shareFile.mockResolvedValue(true);
    draw();
    await tap();
    expect(getFile).toHaveBeenCalledWith("/api/visits/v-1/prescription.pdf?download=1");
    const [file, text] = share.shareFile.mock.calls[0] as [File, string];
    expect([file.name, file.type, text]).toEqual([NAME, "application/pdf", TEXT]);
    expect(share.openChat).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
    expect(await notice(words.shared)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-busy", "false");
  });

  it("names no clinic outside one", async () => {
    auth.current = { ...authStub(), membership: null };
    share.shareFile.mockResolvedValue(true);
    draw();
    await tap();
    expect(share.shareFile.mock.calls[0][1]).toBe("Your prescription from Dr. Maya Rao, , 14 Oct 2025.");
  });

  it("says nothing when the sheet is put aside, and leaves out a doctor no longer on the team", async () => {
    share.shareFile.mockResolvedValue(false);
    draw(null);
    await tap();
    expect(share.shareFile.mock.calls[0][1]).toBe("Your prescription from Smile Care, 14 Oct 2025.");
    expect(screen.queryByText(words.shared)).not.toBeInTheDocument();
  });

  it("offers Send on a card when the phone wants a fresh tap, which shares it", async () => {
    share.shareFile.mockRejectedValueOnce(new DOMException("Tap first", "NotAllowedError")).mockResolvedValueOnce(true);
    draw();
    await tap();
    const ready = await screen.findByRole("dialog", { name: words.readyTitle });
    expect(ready).toHaveTextContent(words.readyBody);
    await userEvent.click(within(ready).getByRole("button", { name: words.send }));
    await waitFor(() => expect(share.shareFile).toHaveBeenCalledTimes(2));
    expect(getFile).toHaveBeenCalledOnce();
    expect(await notice(words.shared)).toBeInTheDocument();
  });

  it("says why when the sheet refuses it", async () => {
    share.shareFile.mockRejectedValue(new TypeError("Bad data"));
    draw();
    await tap();
    const card = await screen.findByRole("alertdialog", { name: words.notSent });
    expect(card).toHaveTextContent(ERROR_MESSAGES.SHARE_FAILED);
  });
});

describe("usePrescriptionSend on a desktop (D246)", () => {
  it("opens the patient's chat as the tap lands, downloads the PDF to attach, and says so", async () => {
    share.sheet = false;
    getFile.mockImplementation(async () => {
      // The chat is open before anything is fetched, so no browser takes it for a pop-up.
      expect(share.openChat).toHaveBeenCalledWith("+919876543210", TEXT);
      return pdf;
    });
    draw();
    await tap();
    expect(saveFile).toHaveBeenCalledWith(pdf, NAME);
    expect(share.shareFile).not.toHaveBeenCalled();
    expect(await notice(words.attachTitle)).toBeInTheDocument();
    expect(await notice(words.attachBody(NAME))).toBeInTheDocument();
  });
});

describe("usePrescriptionSend when the PDF cannot be had", () => {
  it("says why in the API's words or its own, and sends nothing", async () => {
    getFile.mockRejectedValueOnce(new ApiError(404, "PRESCRIPTION_EMPTY", ERROR_MESSAGES.PRESCRIPTION_EMPTY, "req_1"));
    const { unmount } = draw();
    await tap();
    const card = await screen.findByRole("alertdialog", { name: words.notSent });
    expect(card).toHaveTextContent(ERROR_MESSAGES.PRESCRIPTION_EMPTY);
    expect(share.shareFile).not.toHaveBeenCalled();
    unmount();

    getFile.mockRejectedValueOnce(new Error("offline"));
    draw();
    await tap();
    expect(await screen.findByRole("alertdialog", { name: words.notSent })).toHaveTextContent(
      ERROR_MESSAGES.PRESCRIPTION_PDF_FAILED,
    );
    expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-busy", "false");
  });
});
