import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { getFile, saveFile } = vi.hoisted(() => ({ getFile: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/lib/api/client", async (actual) => ({ ...(await actual()), getFile }));
vi.mock("@/lib/download", () => ({ saveFile }));

const { usePrescriptionDownload } = await import("@/features/documents/hooks/usePrescriptionDownload");

const { prescription: words } = UI_TEXT;
const NAME = "Rohan Mehta - 14 Oct 2026 - Prescription.pdf";

function Download() {
  const { download, downloading } = usePrescriptionDownload({
    visitId: "v-1",
    patient: "Rohan Mehta",
    day: "2026-10-14",
  });
  return (
    <button type="button" aria-busy={downloading} onClick={() => void download()}>
      Download
    </button>
  );
}

/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];

beforeEach(() => vi.clearAllMocks());

describe("usePrescriptionDownload (D221, D223)", () => {
  it("asks for the PDF to save, saves it under its name, and says so", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    getFile.mockResolvedValue(pdf);
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(getFile).toHaveBeenCalledWith("/api/visits/v-1/prescription.pdf?download=1");
    expect(saveFile).toHaveBeenCalledWith(pdf, NAME);
    expect(await notice(words.downloaded)).toBeInTheDocument();
    expect(await notice(words.savedAs(NAME))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toHaveAttribute("aria-busy", "false");
  });

  it("says why when it cannot, in the API's words or its own, and saves nothing", async () => {
    getFile.mockRejectedValue(new ApiError(404, "PRESCRIPTION_EMPTY", ERROR_MESSAGES.PRESCRIPTION_EMPTY, "req_1"));
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    const card = await screen.findByRole("alertdialog", { name: words.notDownloaded });
    expect(card).toHaveTextContent(ERROR_MESSAGES.PRESCRIPTION_EMPTY);
    expect(saveFile).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: UI_TEXT.actions.close }));
    getFile.mockRejectedValue(new Error("boom"));
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alertdialog", { name: words.notDownloaded })).toHaveTextContent(
      ERROR_MESSAGES.PRESCRIPTION_PDF_FAILED,
    );
    expect(screen.getByRole("button", { name: "Download" })).toHaveAttribute("aria-busy", "false");
  });
});
